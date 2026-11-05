import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// Drives the real WithdrawalPanel.vue script (computed + methods) with the real withdrawal services and a stand-in for the
// server's withdrawal request, so the flow "page shows 预计到账 -> request carries it -> server refuses -> page refreshes" is checked end to end.
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const amounts=await import('data:text/javascript;base64,'+Buffer.from(read('../services/withdrawal-amount.js')).toString('base64'))
const money=new Function('return '+read('../services/shop.js').match(/export const money = (.*)/)[1])()
const serviceSource=read('../services/wechat-withdrawal.js').replace("import {request,getToken} from './shop'",'').replaceAll('export ','')
const panelSource=read('../components/WithdrawalPanel.vue').match(/<script>([\s\S]*)<\/script>/)[1]
const imported=[...panelSource.matchAll(/^import\s+(?:\{([^}]*)\}|(\w+))\s+from/gm)].flatMap(m=>m[1]?m[1].split(',').map(n=>n.trim()):[m[2]])
const panelBody=panelSource.replace(/^import .*$/gm,'').replace('export default','return')

// maxAmount: the server's per-withdrawal cap on the amount received (经营设置「单笔提现最多到账」, or the server default until the owner
// saves one). Left undefined, the stand-in has no cap and reload() leaves distribution.withdrawalMaxAmount as it was.
function fakeServer(){
 const server={rules:{withdrawMinimum:100,withdrawFee:100,withdrawTaxRate:2000,distributorServiceRate:0},maxAmount:undefined,records:[],sent:[],lose:null}
 server.request=async(path,method,body)=>{
  assert.equal(path,'/withdrawals');assert.equal(method,'POST')
  server.sent.push(JSON.parse(JSON.stringify(body)))
  if(server.lose==='before'){server.lose=null;throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})}
  // ShopWechatWithdrawal.request(): a known key compares amount and receiver only; expectedReceived is checked when creating.
  let record=server.records.find(r=>r.requestKey===body.requestKey)
  if(record){if(record.amount!==body.amount||record.userName!==(body.userName||''))throw Object.assign(Error('同一次提现不能修改金额或收款身份，请核对已有申请'),{uncertain:false})}
  else{
   const net=amounts.withdrawalBreakdown(body.amount,server.rules).net
   // Same order and same words as the server: ShopWechatWithdrawal.netAmount(amount,deductions,cap) refuses an over-cap amount
   // before expectedReceived is compared.
   if(server.maxAmount!==undefined&&net>server.maxAmount)throw Object.assign(Error('单笔最多到账 ¥'+money(server.maxAmount)+'，这次到账 ¥'+money(net)+'，请调小提现金额'),{uncertain:false})
   if(body.expectedReceived!==undefined&&body.expectedReceived!==net)throw Object.assign(Error('到账金额有调整，请刷新后重新确认'),{uncertain:false})
   record={id:server.records.length+1,requestKey:body.requestKey,amount:body.amount,userName:body.userName||'',received:net};server.records.push(record)
  }
  if(server.lose==='after'){server.lose=null;throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})}
  return {withdrawal:{id:record.id}}
 }
 return server
}

function mountPanel(server,{rules,distribution,saved}){
 const storage=new Map([['shop-owner',123],...(saved?[['shop-withdrawal-intent-123',saved]]:[])]),uni={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k)}
 const service=new Function('request','getToken','uni','wx',serviceSource+';return {createWithdrawal,reconcileWithdrawalIntent,queryWithdrawal,confirmWithdrawal,withdrawalLabel}')(server.request,()=>'customer-a',uni,{})
 const visited=[],toasts=[]
 const env={...amounts,...service,money,go:screen=>visited.push(screen),notify:e=>toasts.push(e.message||String(e)),formatDate:v=>String(v),CommissionNotice:{},WithdrawalRules:{}}
 for(const name of imported)assert.ok(name in env,'test needs a stand-in for '+name)
 const options=new Function(...imported,panelBody)(...imported.map(name=>env[name]))
 const vm={mode:'apply',rules,distribution,...options.data(),isWechat:true,emitted:[],$emit(name){vm.emitted.push(name)}}
 for(const [name,get] of Object.entries(options.computed))Object.defineProperty(vm,name,{get:()=>get.call(vm)})
 for(const [name,method] of Object.entries(options.methods))vm[name]=method.bind(vm)
 options.watch.rows.handler.call(vm,vm.rows)
 // What ShopScreen.refresh(true) does on @refresh: reload /bootstrap rules and /distribution from the server.
 // /distribution carries the server's current cap as withdrawalMaxAmount (ShopWechatWithdrawal.readiness()).
 vm.reload=()=>{vm.rules={...server.rules};vm.distribution={...vm.distribution,...(server.maxAmount===undefined?{}:{withdrawalMaxAmount:server.maxAmount})}}
 return {vm,storage,visited,toasts}
}
const distribution={available:50000,withdrawalReady:true,withdrawalMaxAmount:0,withdrawals:[]}

test('the request carries exactly the 预计到账 the page shows, and nothing is sent while the amount has a problem',async()=>{
 const server=fakeServer(),{vm,visited}=mountPanel(server,{rules:{...server.rules,distributorServiceRate:100},distribution});server.rules.distributorServiceRate=100
 vm.amountText='0.5';assert.equal(vm.valid,false);assert.equal(vm.expectedReceived,null)
 await vm.submit();assert.equal(server.sent.length,0)
 vm.amountText='100'
 // 100.00 - 手续费 1.00 - 代扣税费 20.00 - 平台服务费 1.00
 assert.equal(vm.expectedReceived,7800);assert.equal(money(vm.expectedReceived),'78.00')
 await vm.submit()
 assert.equal(server.sent[0].amount,10000);assert.equal(server.sent[0].expectedReceived,7800);assert.equal(server.records[0].received,7800);assert.deepEqual(visited,['withdrawals'])
})

test('when the server says the amounts changed, the page reloads the fees, keeps the amount and shows the new 预计到账',async()=>{
 const server=fakeServer(),{vm,storage,visited,toasts}=mountPanel(server,{rules:{...server.rules},distribution})
 vm.amountText='100';assert.equal(vm.expectedReceived,7900)
 server.rules.distributorServiceRate=100 // the 1% platform service fee was switched on after the page loaded
 await vm.submit()
 assert.equal(server.sent[0].expectedReceived,7900);assert.equal(server.records.length,0)
 assert.equal(vm.error,'到账金额有调整，已为你更新预计到账，请核对后重新提交');assert.deepEqual(toasts,[vm.error])
 assert.equal(vm.amountText,'100');assert.ok(vm.emitted.includes('refresh'));assert.deepEqual(visited,[])
 assert.equal(storage.has('shop-withdrawal-intent-123'),false);assert.equal(vm.uncertainIntent,null)
 vm.reload()
 assert.equal(vm.expectedReceived,7800);assert.equal(vm.breakdown.service,100)
 await vm.submit()
 assert.equal(vm.error,'');assert.equal(server.sent[1].expectedReceived,7800);assert.notEqual(server.sent[1].requestKey,server.sent[0].requestKey)
 assert.equal(server.records.length,1);assert.equal(server.records[0].received,7800);assert.deepEqual(visited,['withdrawals'])
})

test('retrying a lost response after the fees changed sends the same request and gets the same withdrawal back',async()=>{
 const server=fakeServer(),{vm,storage,visited}=mountPanel(server,{rules:{...server.rules},distribution})
 vm.amountText='100';server.lose='after'
 await vm.submit()
 assert.equal(server.records.length,1);assert.ok(vm.uncertainIntent);assert.equal(vm.uncertainIntent.expectedReceived,7900)
 assert.equal(vm.pendingLine,'提现金额 ¥100.00，预计到账 ¥79.00。继续核对会使用同一笔申请，不会重复扣减佣金。')
 server.rules.distributorServiceRate=100;vm.reload();assert.equal(vm.expectedReceived,7800)
 await vm.retry()
 assert.deepEqual(server.sent[1],server.sent[0]);assert.equal(server.records.length,1);assert.equal(server.records[0].received,7900)
 assert.deepEqual(visited,['withdrawals']);assert.equal(storage.has('shop-withdrawal-intent-123'),false);assert.equal(vm.error,'')
})

test('retrying a request that never arrived after the fees changed is refused, then the same amount shows the new 预计到账',async()=>{
 const server=fakeServer(),first=mountPanel(server,{rules:{...server.rules},distribution})
 first.vm.amountText='100';server.lose='before'
 await first.vm.submit();assert.ok(first.vm.uncertainIntent);assert.equal(server.records.length,0)
 // the customer comes back later with new fees: the pending request is restored from storage and the amount box is empty
 server.rules.distributorServiceRate=100
 const {vm,storage,visited}=mountPanel(server,{rules:{...server.rules},distribution,saved:first.storage.get('shop-withdrawal-intent-123')})
 assert.equal(vm.uncertainIntent.expectedReceived,7900);assert.equal(vm.amountText,'')
 await vm.retry()
 assert.deepEqual(server.sent[1],server.sent[0]);assert.equal(server.records.length,0)
 assert.equal(vm.error,'到账金额有调整，已为你更新预计到账，请核对后重新提交');assert.equal(vm.uncertainIntent,null);assert.ok(vm.emitted.includes('refresh'))
 assert.equal(vm.amountText,'100.00');assert.equal(storage.has('shop-withdrawal-intent-123'),false);assert.deepEqual(visited,[])
 vm.reload();assert.equal(vm.expectedReceived,7800)
 await vm.submit()
 assert.notEqual(server.sent[2].requestKey,server.sent[0].requestKey);assert.equal(server.sent[2].expectedReceived,7800)
 assert.equal(server.records.length,1);assert.equal(server.records[0].received,7800);assert.deepEqual(visited,['withdrawals'])
})

// ---- 单笔提现最多到账: the cap the shop owner sets in 经营设置 reaches the page only as distribution.withdrawalMaxAmount ----
const template=read('../components/WithdrawalPanel.vue').match(/<template>([\s\S]*)<\/template>/)[1]
const CAP_LINE=/<text v-if="([^"]*)" class="hint">(单笔[^<]*)<\/text>/
const AMOUNT_ERROR=/<text v-if="([^"]*)" class="hint error">([^<]*)<\/text>/
const REAL_NAME=/<template v-if="([^"]*)"><text class="form-label">(微信实名姓名)<\/text>/
const SUBMIT_DISABLED=/<button class="ui-button primary" :loading="busy" :disabled="([^"]*)" @click="submit">/
// Vue expressions in the template are evaluated against the panel (non-strict Function, so `with` is allowed).
const evaluate=(vm,expr)=>new Function('vm','with(vm){return ('+expr+')}')(vm)
// What the member sees for one piece of the template: null while its v-if is false, otherwise the text with {{…}} filled in.
function shown(vm,pattern){
 const m=template.match(pattern);assert.ok(m,'template still has '+pattern)
 return evaluate(vm,m[1])?m[2].replace(/\{\{([\s\S]*?)\}\}/g,(_,expr)=>String(evaluate(vm,expr))):null
}
const submitDisabled=vm=>{const m=template.match(SUBMIT_DISABLED);assert.ok(m,'template still has the submit button');return !!evaluate(vm,m[1])}
const capped=maximum=>({...distribution,available:300000,withdrawalMaxAmount:maximum})

test('a 500.00 cap from the server is shown, fills 全部提现 up to it and is checked on the amount received',async()=>{
 const server=fakeServer();server.maxAmount=50000
 const {vm,visited}=mountPanel(server,{rules:{...server.rules},distribution:capped(50000)})
 assert.equal(vm.maximum,50000);assert.equal(shown(vm,CAP_LINE),'单笔到账金额最高 ¥500.00')
 // 手续费 1.00 and 20% 代扣税费: 626.25 - 1.00 - 125.25 = 500.00 arrives, exactly the cap
 vm.all();assert.equal(vm.amountText,'626.25');assert.equal(vm.valid,true);assert.equal(vm.expectedReceived,50000);assert.equal(submitDisabled(vm),false)
 assert.equal(shown(vm,AMOUNT_ERROR),null)
 // one more 分 arrives as 500.01
 vm.amountText='626.26';assert.equal(vm.valid,false);assert.equal(vm.expectedReceived,null);assert.equal(submitDisabled(vm),true)
 assert.equal(shown(vm,AMOUNT_ERROR),'单笔到账金额超过限额，请调整金额')
 await vm.submit();assert.equal(server.sent.length,0)
 // more than 200 元 arriving is fine under this cap
 vm.amountText='300';assert.equal(vm.valid,true);assert.equal(vm.expectedReceived,23900)
 vm.amountText='626.25';await vm.submit()
 assert.equal(vm.error,'');assert.equal(server.sent[0].amount,62625);assert.equal(server.sent[0].expectedReceived,50000);assert.equal(server.records[0].received,50000)
 assert.deepEqual(visited,['withdrawals'])
})

test('a 1999.99 cap: the largest amount arrives as exactly 1999.99, and an amount arriving as 2000.00 is refused without asking for a real name',async()=>{
 const server=fakeServer();server.maxAmount=199999
 const {vm,visited}=mountPanel(server,{rules:{...server.rules},distribution:capped(199999)})
 assert.equal(shown(vm,CAP_LINE),'单笔到账金额最高 ¥1999.99')
 // 2501.23 - 1.00 - 500.24 = 1999.99
 vm.all();assert.equal(vm.amountText,'2501.23');assert.equal(vm.expectedReceived,199999);assert.equal(vm.needsRealName,false);assert.equal(shown(vm,REAL_NAME),null)
 // 2501.24 - 1.00 - 500.24 = 2000.00: over the cap, so the page says so and does not show the 2,000 元 real-name box next to it
 vm.amountText='2501.24';assert.equal(vm.netAmount,200000);assert.equal(vm.valid,false)
 assert.equal(shown(vm,AMOUNT_ERROR),'单笔到账金额超过限额，请调整金额');assert.equal(vm.needsRealName,false);assert.equal(shown(vm,REAL_NAME),null);assert.equal(submitDisabled(vm),true)
 await vm.submit();assert.equal(server.sent.length,0)
 vm.amountText='2501.23';await vm.submit()
 assert.equal(server.sent[0].amount,250123);assert.equal(server.sent[0].expectedReceived,199999);assert.equal('userName' in server.sent[0],false)
 assert.equal(server.records[0].received,199999);assert.deepEqual(visited,['withdrawals'])
})

test('when the server itself allows 2,000 元 or more (its default before the owner saves a cap), the real-name box still appears',async()=>{
 const server=fakeServer();server.maxAmount=300000
 const {vm}=mountPanel(server,{rules:{...server.rules},distribution:capped(300000)})
 assert.equal(shown(vm,CAP_LINE),'单笔到账金额最高 ¥3000.00')
 vm.amountText='2501.24';assert.equal(vm.valid,true);assert.equal(vm.expectedReceived,200000);assert.equal(vm.needsRealName,true)
 assert.equal(shown(vm,REAL_NAME),'微信实名姓名');assert.equal(submitDisabled(vm),true)
 vm.userName=' 张三 ';assert.equal(submitDisabled(vm),false)
 await vm.submit()
 assert.equal(server.sent[0].userName,'张三');assert.equal(server.records[0].received,200000)
})

test('the owner lowers the cap while the page is open: the server refuses, the page shows why, reloads the new cap and keeps the amount',async()=>{
 const server=fakeServer();server.maxAmount=50000
 const {vm,storage,visited,toasts}=mountPanel(server,{rules:{...server.rules},distribution:capped(50000)})
 // 400.00 - 1.00 - 80.00 = 319.00 fits the 500.00 shown on the page
 vm.amountText='400';assert.equal(vm.expectedReceived,31900)
 server.maxAmount=30000 // lowered to 300.00 in 经营设置
 await vm.submit()
 assert.equal(server.records.length,0);assert.equal(server.sent[0].expectedReceived,31900)
 // the server's own words reach the promoter unchanged: both amounts, and what to do
 assert.equal(vm.error,'单笔最多到账 ¥300.00，这次到账 ¥319.00，请调小提现金额');assert.deepEqual(toasts,[vm.error])
 // not taken for "the fees changed": that path would replace the text and put back a stored amount
 assert.doesNotMatch(vm.error,/到账金额有调整/)
 // a definite refusal: nothing was created, so no "结果待确认" is kept, and the page asks for fresh numbers
 assert.ok(vm.emitted.includes('refresh'));assert.deepEqual(visited,[]);assert.equal(storage.has('shop-withdrawal-intent-123'),false);assert.equal(vm.uncertainIntent,null)
 assert.equal(vm.amountText,'400')
 vm.reload()
 assert.equal(shown(vm,CAP_LINE),'单笔到账金额最高 ¥300.00');assert.equal(vm.valid,false);assert.equal(vm.expectedReceived,null)
 assert.equal(shown(vm,AMOUNT_ERROR),'单笔到账金额超过限额，请调整金额')
 // 376.25 - 1.00 - 75.25 = 300.00
 vm.all();assert.equal(vm.amountText,'376.25');assert.equal(vm.expectedReceived,30000)
 await vm.submit()
 assert.equal(vm.error,'');assert.notEqual(server.sent[1].requestKey,server.sent[0].requestKey);assert.equal(server.sent[1].expectedReceived,30000)
 assert.equal(server.records.length,1);assert.equal(server.records[0].received,30000);assert.deepEqual(visited,['withdrawals'])
})

test('the owner raises the cap while the page is open: after the regular refresh the larger amount can be submitted',async()=>{
 const server=fakeServer();server.maxAmount=20000
 const {vm,visited}=mountPanel(server,{rules:{...server.rules},distribution:capped(20000)})
 vm.amountText='400';assert.equal(vm.valid,false);assert.equal(shown(vm,AMOUNT_ERROR),'单笔到账金额超过限额，请调整金额')
 await vm.submit();assert.equal(server.sent.length,0)
 server.maxAmount=50000;vm.reload() // ShopScreen reloads /distribution every 15 seconds on this screen
 assert.equal(shown(vm,CAP_LINE),'单笔到账金额最高 ¥500.00');assert.equal(vm.valid,true);assert.equal(vm.expectedReceived,31900)
 await vm.submit()
 assert.equal(server.records[0].received,31900);assert.deepEqual(visited,['withdrawals'])
})

test('no cap from the server means no cap line and no cap check (the server still has the final say)',()=>{
 const server=fakeServer(),{vm}=mountPanel(server,{rules:{...server.rules},distribution:capped(0)})
 assert.equal(vm.maximum,0);assert.equal(shown(vm,CAP_LINE),null)
 vm.all();assert.equal(vm.amountText,'3000.00');assert.equal(vm.valid,true)
})

test('the cap is never written into the withdrawal pages: it always comes from the server',()=>{
 const panel=read('../components/WithdrawalPanel.vue'),amountRules=read('../services/withdrawal-amount.js'),staff=read('../pages/staff/components/StaffManagementPanel.vue')
 for(const [name,source] of [['WithdrawalPanel.vue',panel],['withdrawal-amount.js',amountRules],['StaffManagementPanel.vue',staff]]){
  assert.doesNotMatch(source,/(?<![\d,.])20000(?!\d)/,name+' has 20000 分 written in')
  assert.doesNotMatch(source,/(?<![\d,.])200(\.00)?\s*元/,name+' has 200 元 written in')
  assert.doesNotMatch(source,/¥\s*200(\.00)?(?![\d.,])/,name+' has ¥200 written in')
 }
 assert.match(panel,/maximum\(\)\{return Number\(this\.distribution\.withdrawalMaxAmount\|\|0\)\}/)
 // the saved shop rules have no cap until the owner saves one; only /distribution carries the value the server really uses
 assert.doesNotMatch(panel,/withdrawMaxAmount/)
})
