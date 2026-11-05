import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/partner-tier.js',import.meta.url),'utf8')
const {partnerTierSummary,partnerTierLadder,partnerStatusLine,yuanText,discountText,AUTO_COMMISSION_MAX,autoCommissionRate,percentText,retailCommissionSummary,retailCommissionShort,retailCommissionNote}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

const tiers=[{name:'加盟一档',rate:3800,referenceAmount:1980000},{name:'加盟二档',rate:2800,referenceAmount:4980000},{name:'共建合伙人',rate:2200,referenceAmount:9800000}]
const base={distributor:true,applicationState:'approved',discountRates:[3800,2800,2200],thresholds:[1980000,4980000,9800000],tiers}

test('amounts and discounts are formatted from backend numbers',()=>{
 assert.equal(yuanText(1980000),'¥19,800');assert.equal(yuanText(123456),'¥1,234.56');assert.equal(yuanText(null),'¥0')
 assert.equal(discountText(3800),'3.8折');assert.equal(discountText(2250),'2.25折');assert.equal(discountText(0),'')
})
test('the ladder follows configured thresholds, not built-in defaults',()=>{
 const ladder=partnerTierLadder({...base,discountRates:[4000,3000,2000],thresholds:[1000000,2000000,3000000]})
 assert.deepEqual(ladder.map(r=>[r.thresholdText,r.rateText]),[['¥10,000','4折'],['¥20,000','3折'],['¥30,000','2折']])
 assert.deepEqual(partnerTierLadder({}),[])
})
test('fee based tier shows registered fee and the gap to the next tier',()=>{
 const s=partnerTierSummary({...base,enabled:true,tier:1,mode:'auto',tierSource:'fee',feeTotal:2000000,automaticTier:1,name:'加盟一档',rate:3800,nextAmount:4980000,remainingAmount:2980000,nextRate:2800})
 assert.equal(s.kind,'fee');assert.equal(s.badge,'按已登记加盟款');assert.match(s.title,/3\.8折拿货/)
 assert.equal(s.feeText,'已登记加盟款 ¥20,000');assert.equal(s.nextText,'还差加盟款 ¥29,800，累计满 ¥49,800 可享 2.8折')
 assert.equal(s.currentLevel,1);assert.equal(s.canBuy,true)
})
test('highest fee tier says so instead of inventing a next step',()=>{
 const s=partnerTierSummary({...base,enabled:true,tier:3,mode:'auto',tierSource:'fee',feeTotal:9800000,name:'共建合伙人',rate:2200})
 assert.equal(s.nextText,'已是最高档拿货折扣');assert.equal(s.currentLevel,3)
})
test('manually assigned tier is labelled as set by the merchant',()=>{
 const s=partnerTierSummary({...base,enabled:true,tier:3,mode:'fixed',tierSource:'manual',feeTotal:0,name:'共建合伙人',rate:2200})
 assert.equal(s.kind,'manual');assert.equal(s.badge,'商家指定');assert.match(s.title,/2\.2折拿货/);assert.equal(s.nextText,'');assert.equal(s.currentLevel,0)
})
test('approved distributor without registered fee can promote but not buy yet',()=>{
 const s=partnerTierSummary({...base,enabled:false,tier:0,mode:'auto',tierSource:'none',feeTotal:0,nextAmount:1980000,remainingAmount:1980000,nextRate:3800})
 assert.equal(s.kind,'waiting');assert.equal(s.canBuy,false);assert.equal(s.title,'已通过审核，可以分享商品赚佣金')
 assert.match(s.lines[0],/登记加盟款后即可拿货/);assert.equal(s.ladder.length,3);assert.equal(s.feeText,'')
})
test('partial fee below the first threshold shows what is still missing',()=>{
 const s=partnerTierSummary({...base,enabled:false,tierSource:'none',feeTotal:1000000})
 assert.equal(s.kind,'waiting');assert.equal(s.feeText,'已登记加盟款 ¥10,000');assert.match(s.nextText,/还差加盟款 ¥9,800/)
})
test('blocked and not yet approved accounts get the right guidance',()=>{
 assert.equal(partnerTierSummary({...base,enabled:false,mode:'blocked',tierSource:'blocked'}).kind,'blocked')
 const pending=partnerTierSummary({distributor:false,applicationState:'pending'})
 assert.equal(pending.kind,'pending');assert.equal(pending.showApply,true)
 assert.equal(partnerTierSummary({distributor:false,applicationState:'none'}).kind,'apply')
})
test('guidance never mentions an upline commission or a spendable balance',()=>{
 for(const profile of [{...base,enabled:true,tierSource:'fee',rate:3800,tier:1,feeTotal:1980000},{...base,tierSource:'none'},{distributor:false}]){
  const s=partnerTierSummary(profile),text=[s.title,s.feeText,s.nextText,...s.lines].join('')
  assert.doesNotMatch(text,/上级|差价|可用余额|netSpend|净实付/)
 }
})
test('entry line summarises each state briefly',()=>{
 assert.equal(partnerStatusLine({...base,enabled:true,tierSource:'fee',name:'加盟一档',rate:3800,tier:1}),'加盟一档 · 3.8折拿货')
 assert.equal(partnerStatusLine({...base,tierSource:'none'},'approved'),'已通过审核 · 登记加盟款后即可拿货')
 assert.equal(partnerStatusLine(null,'approved'),'已通过审核 · 登记加盟款后即可拿货')
 assert.equal(partnerStatusLine(null,'pending'),'申请审核中 · 查看进度')
 assert.equal(partnerStatusLine({...base,tierSource:'blocked',mode:'blocked'},'approved'),'专属拿货已暂停 · 请联系客服')
})
test('retail commission by purchase tier is 1 minus the discount, at most 90%',()=>{
 assert.equal(AUTO_COMMISSION_MAX,9000)
 assert.deepEqual([3800,2800,2200].map(autoCommissionRate),[6200,7200,7800])
 assert.equal(autoCommissionRate(500),9000);assert.equal(autoCommissionRate(0),0);assert.equal(autoCommissionRate(10000),0);assert.equal(autoCommissionRate(undefined),0)
 assert.equal(percentText(7800),'78%');assert.equal(percentText(650),'6.5%');assert.equal(percentText(null),'');assert.equal(percentText(undefined),'')
 assert.deepEqual(partnerTierLadder(base).map(r=>r.commissionText),['零售佣金 62%','零售佣金 72%','零售佣金 78%'])
})
test('partner page states the retail commission from /partner retailCommission',()=>{
 assert.equal(retailCommissionSummary({source:'partner_tier',rate:7800,discountRate:2200,partnerTier:3,tierName:'共建合伙人',excludedCount:0}),'你的零售推广佣金：客户实付 × 78%（按拿货档位 2.2折）')
 assert.equal(retailCommissionSummary({source:'member',rate:600}),'你的零售推广佣金：客户实付 × 6%（商家单独设置）')
 assert.equal(retailCommissionSummary({source:'rule',rate:500}),'你的零售推广佣金：按卖出奖励规则（通用比例 5%）')
 assert.equal(retailCommissionSummary({source:'rule',rate:null}),'你的零售推广佣金：按卖出奖励规则')
 assert.equal(retailCommissionSummary(null),'');assert.equal(retailCommissionSummary(undefined),'')
 assert.equal(retailCommissionNote({source:'partner_tier',rate:7800,excludedCount:2}),'只影响之后的新订单，已下单的按下单时的比例。不参加专属拿货的商品仍按卖出奖励规则计算。')
 assert.equal(retailCommissionNote({source:'partner_tier',rate:7800,excludedCount:0}),'只影响之后的新订单，已下单的按下单时的比例。')
 assert.equal(retailCommissionNote({source:'member',rate:600}),'')
})
test('distribution centre shows a short retail commission line from /distribution retailCommission',()=>{
 assert.equal(retailCommissionShort({source:'partner_tier',rate:7800,discountRate:2200}),'78%（按拿货档位）')
 assert.equal(retailCommissionShort({source:'member',rate:600}),'6%（商家单独设置）')
 assert.equal(retailCommissionShort({source:'rule',rate:500}),'5%（按卖出奖励规则）')
 assert.equal(retailCommissionShort({source:'rule',rate:null}),'按卖出奖励规则')
 assert.equal(retailCommissionShort(undefined),'')
 for(const view of [{source:'partner_tier',rate:7800,discountRate:2200},{source:'member',rate:600},{source:'rule',rate:null}])for(const text of [retailCommissionShort(view),retailCommissionSummary(view)])assert.doesNotMatch(text,/rate|source|partner|member|万分|null|undefined|NaN/,text)
})
test('pages use the new commission wording and no longer say the discount does not decide commission',()=>{
 const center=readFileSync(new URL('../components/PartnerCenter.vue',import.meta.url),'utf8'),screen=readFileSync(new URL('../components/ShopScreen.vue',import.meta.url),'utf8')
 assert.equal(center.includes('拿货折扣不决定佣金比例'),false)
 assert.match(center,/commissionSummary\(\)\{return this\.data\.profile\.distributor\?retailCommissionSummary\(this\.data\.retailCommission\):''\}/)
 assert.match(center,/<view v-if="commissionSummary" class="commission-line">/)
 assert.match(screen,/<view v-if="retailCommissionShort\(distribution\.retailCommission\)" class="line"><text>我的零售佣金比例<\/text>/)
})
test('推广资格或账号停用时显示暂无零售佣金，不误写成按卖出奖励规则',async()=>{
 const m=await import('../services/partner-tier.js')
 assert.equal(m.retailCommissionShort({source:'none'}),'暂无（推广资格已停用）')
})
