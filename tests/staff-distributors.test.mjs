import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers} from './staff-component-harness.mjs'
const d=await loadHelpers('../pages/staff/services/staff-distributors.js')

// ui-spec §4.3 (= api-spec §4.1/§4.2) samples.
const row={memberId:88,nickname:'新朋友',realName:'王推广',phoneTail:'5555',phone:'13800005555',applicationState:'approved',accountEnabled:true,self:false,
 enabled:true,tier:1,tierName:'银卡',discountRate:3800,tierSource:'fee',mode:'auto',automaticTier:1,
 feeTotal:1980000,thresholds:[1980000,4980000,9800000],discountRates:[3800,2800,2200],nextAmount:4980000,remainingAmount:3000000,nextRate:2800,
 retailCommission:{source:'partner_tier',rate:6200,discountRate:3800,partnerTier:1,tierName:'银卡',excludedCount:0},
 monthPerformance:{from:'2026-09-01',to:'2026-09-30',paid:174400,refunded:0,net:174400,orders:8},createdAt:'2026-08-02 10:11:12'}
const tiers=[{name:'银卡',rate:3800,referenceAmount:1980000},{name:'金卡',rate:2800,referenceAmount:4980000},{name:'钻石',rate:2200,referenceAmount:9800000}]
const profile={enabled:true,distributor:true,applicationState:'approved',tier:1,mode:'auto',feeTotal:1980000,automaticTier:1,tierSource:'fee',discountRates:[3800,2800,2200],thresholds:[1980000,4980000,9800000],tiers,name:'银卡',rate:3800,referenceAmount:1980000,nextAmount:4980000,remainingAmount:3000000,nextRate:2800}
const member={memberId:88,nickname:'新朋友',realName:'王推广',phoneTail:'5555',phone:'13800005555',applicationState:'approved',accountEnabled:true,createdAt:'2026-08-02 10:11:12'}
const detail={member,profile,fees:{records:[{id:31,amount:1980000,paidAt:'2026-09-20 14:30',method:'bank',methodLabel:'银行转账',referenceNo:'HX2026092001',hasProof:true,note:'首笔加盟款',state:'valid',createdBy:'boss（小程序）',createdAt:'2026-09-20 14:35',voidedBy:null,voidedAt:'',voidReason:null}],totals:{validAmount:1980000,validCount:1,monthAmount:1980000,monthCount:1},truncated:false},
 commission:{current:{source:'partner_tier',rate:6200,discountRate:3800,partnerTier:1,tierName:'银卡',excludedCount:0},single:null,afterRemove:{source:'partner_tier',rate:6200}},
 performance:{thisMonth:{from:'2026-09-01',to:'2026-09-30',paid:174400,refunded:0,net:174400,orders:8},lastMonth:{from:'2026-08-01',to:'2026-08-31',paid:90000,refunded:0,net:90000,orders:4}},
 actions:{self:false,canRegisterFee:true,canManage:true}}
const NOW=Date.parse('2026-09-26T14:30:00+08:00')
const form=(x={})=>({kind:'fee',amount:'19800',method:'bank',date:'2026-09-26',time:'14:30',referenceNo:'',note:'',proofUrl:'',requestKey:'mfee_abc_123456',...x})

test('large franchise fees are accepted up to the server limit',()=>{
 assert.equal(d.bigYuanToFen('19800'),1980000);assert.equal(d.bigYuanToFen('0.01'),1);assert.equal(d.bigYuanToFen('1000000000'),100000000000)
 assert.throws(()=>d.bigYuanToFen('1000000000.01'),{message:'金额应在0.01至1,000,000,000元之间'})
 assert.throws(()=>d.bigYuanToFen('0'),{message:'金额应在0.01至1,000,000,000元之间'})
 for(const v of ['1.005','-1','1e3'])assert.throws(()=>d.bigYuanToFen(v),{message:'请填写正确的金额，最多保留两位小数'})
 assert.throws(()=>d.bigYuanToFen(''),{message:'请填写收款金额'})
 assert.throws(()=>d.bigYuanToFen('  '),{message:'请填写收款金额'})
 assert.equal(d.bigYuanToFen('１９８００'),1980000)
 assert.equal(d.bigYuanToFen('218.10'),21810)
})

test('fee form checks every field in order',()=>{
 assert.deepEqual(d.readFeeForm(form(),NOW),{body:{amount:1980000,method:'bank',paidAt:'2026-09-26 14:30',referenceNo:'',note:'',proofUrl:'',requestKey:'mfee_abc_123456',confirmSharedReference:false}})
 assert.equal(d.readFeeForm(form({amount:''}),NOW).error,'请填写收款金额')
 assert.equal(d.readFeeForm(form({method:'card'}),NOW).error,'请选择收款方式')
 assert.equal(d.readFeeForm(form({date:'2026-02-30'}),NOW).error,'请选择收款时间')
 assert.equal(d.readFeeForm(form({time:'25:00'}),NOW).error,'请选择收款时间')
 assert.equal(d.readFeeForm(form({date:'2019-12-31'}),NOW).error,'收款时间不能早于2020年')
 assert.equal(d.readFeeForm(form({time:'14:41'}),NOW).error,'收款时间不能晚于现在')
 assert.equal(d.readFeeForm(form({time:'14:40'}),NOW).error,undefined)
 assert.equal(d.readFeeForm(form({referenceNo:'A'.repeat(81)}),NOW).error,'凭证号不超过80字')
 assert.equal(d.readFeeForm(form({note:'备'.repeat(301)}),NOW).error,'备注不超过300字')
 assert.equal(d.readFeeForm(form({proofUrl:'/x.png'}),NOW).error,'凭证图片无效，请重新上传')
 assert.equal(d.readFeeForm(form({requestKey:'short'}),NOW).error,'请重新打开登记窗口后再提交')
 const ok=d.readFeeForm(form({referenceNo:' ＨＸ001 ',note:' 首笔 ',proofUrl:'/shop/admin/license/00000000-0000-4000-8000-000000000001.png'}),NOW).body
 assert.equal(ok.referenceNo,'HX001');assert.equal(ok.note,'首笔');assert.equal(ok.proofUrl,'/shop/admin/license/00000000-0000-4000-8000-000000000001.png')
})

test('request key format',()=>{
 const key=d.newFeeRequestKey(0,()=>0.5)
 assert.match(key,d.FEE_REQUEST_KEY);assert.match(key,/^mfee_0_[a-z0-9]{6,}$/)
 assert.match(d.newFeeRequestKey(),d.FEE_REQUEST_KEY)
 assert.notEqual(d.newFeeRequestKey(1,()=>0.1),d.newFeeRequestKey(1,()=>0.2))
})

test("list search uses the server's grammar and words",()=>{
 for(const q of ['','#12','13800001234','1234','张三','138 0000 1234'])assert.equal(d.searchProblem(q),'',q)
 assert.equal(d.searchProblem('#ab'),'会员编号请输入 # 加数字，例如 #123')
 assert.equal(d.searchProblem('#0'),'会员编号请输入 # 加数字，例如 #123')
 assert.equal(d.searchProblem('12345'),'请输入完整的11位手机号、手机号后4位，或在会员号前加 #（例如 #123）')
 assert.equal(d.searchProblem('张'),'昵称或姓名至少输入2个字')
 assert.equal(d.searchProblem('王'.repeat(41)),'搜索内容最多40个字')
 assert.equal(d.listQuery({q:' 王 ',filter:'buying',page:2}),'q=%E7%8E%8B&filter=buying&page=2')
 assert.equal(d.listQuery({q:'',filter:'x',page:1}),'q=&filter=all&page=1')
 assert.equal(d.listQuery(),'q=&filter=all&page=1')
 assert.doesNotMatch(d.listQuery({q:'#1'}),/size=/)
})

test('tier status reads like the PC',()=>{
 assert.deepEqual(d.tierStatus(d.rowProfile(row),row.retailCommission),{canBuy:true,discount:'3.8折',source:'按加盟款自动 · 银卡',next:'再登记 ¥30,000.00 可升到 2.8折'})
 const blocked={...row,enabled:false,tier:0,tierName:undefined,discountRate:0,tierSource:'blocked',mode:'blocked'}
 const b=d.tierStatus(d.rowProfile(blocked),{source:'rule',rate:1000})
 assert.equal(b.source,'已停用拿货');assert.equal(b.next,'仍可推广，零售佣金按卖出奖励规则');assert.equal(b.canBuy,false)
 assert.equal(d.tierStatus(d.rowProfile(blocked),{source:'member',rate:7000}).next,'仍可推广，零售佣金按单独比例')
 const manual=d.tierStatus(d.rowProfile({...row,tier:2,tierName:'金卡',discountRate:2800,tierSource:'manual',mode:'fixed',automaticTier:1}))
 assert.deepEqual(manual,{canBuy:true,discount:'2.8折',source:'手动指定 · 金卡',next:'按已登记加盟款应为 3.8折'})
 const none=d.tierStatus(d.rowProfile({...row,enabled:false,tier:0,tierName:undefined,discountRate:0,tierSource:'none',automaticTier:0,feeTotal:0,nextAmount:undefined}))
 assert.equal(none.source,'未登记加盟款');assert.equal(none.next,'登记满 ¥19,800.00 可开通 3.8折')
 const below=d.tierStatus(d.rowProfile({...row,enabled:false,tier:0,tierSource:'none',automaticTier:0,feeTotal:980000}))
 assert.equal(below.source,'加盟款未满第一档');assert.equal(below.next,'再登记 ¥10,000.00 可开通 3.8折')
 // 点测发现：待审核的申请人在列表里写成“未通过分销审核”，像是已经被驳回；详情页写的是“推广资格待审核”
 assert.equal(d.tierStatus(d.rowProfile({...row,applicationState:'pending'})).source,'推广资格待审核')
 assert.equal(d.tierStatus(d.rowProfile({...row,applicationState:'pending'})).source,d.applicationText('pending'))
 assert.equal(d.tierStatus(d.rowProfile({...row,applicationState:'rejected'})).source,'未通过分销审核')
 assert.equal(d.tierStatus({...detail.profile,accountEnabled:false}).source,'账号已停用')
 assert.equal(d.tierStatus({...detail.profile,tier:3,name:'钻石',rate:2200,remainingAmount:undefined,nextRate:undefined,accountEnabled:true}).next,'已是最高档')
 assert.deepEqual(d.tierLadder(profile),['第一档 银卡：加盟款满 ¥19,800.00，3.8折','第二档 金卡：加盟款满 ¥49,800.00，2.8折','第三档 钻石：加盟款满 ¥98,000.00，2.2折'])
 assert.deepEqual(d.tierLadder(null),[])
})

test('commission wording and what applies after removal',()=>{
 assert.equal(d.commissionText({source:'member',rate:7000}),'零售佣金 70%（单独比例，优先）')
 assert.equal(d.commissionText({source:'partner_tier',rate:6200}),'零售佣金 62%（按拿货档位）')
 assert.equal(d.commissionText({source:'rule',rate:1000}),'零售佣金按卖出奖励规则（10%）')
 assert.equal(d.commissionText({source:'rule',rate:null}),'零售佣金按卖出奖励规则')
 assert.equal(d.commissionText({source:'none'}),'暂无零售佣金（推广资格或账号已停用）')
 assert.equal(d.commissionText(null),'')
 assert.equal(d.afterRemoveText({source:'partner_tier',rate:6200}),'按拿货档位 62%')
 assert.equal(d.afterRemoveText({source:'rule',rate:1000}),'按卖出奖励规则 10%')
 assert.equal(d.afterRemoveText({source:'rule',rate:null}),'按卖出奖励规则')
 assert.equal(d.afterRemoveText({source:'none'}),'暂无（推广资格或账号已停用）')
})

test('percent input',()=>{
 assert.equal(d.percentToRate('62.5'),6250);assert.equal(d.percentToRate('90'),9000);assert.equal(d.percentToRate('0'),0);assert.equal(d.percentToRate('７０'),7000)
 assert.throws(()=>d.percentToRate('90.01'),{message:'单独比例须为0%至90%'})
 assert.throws(()=>d.percentToRate('1.234'),{message:'比例请填数字，最多保留两位小数'})
 assert.throws(()=>d.percentToRate(''),{message:'比例请填数字，最多保留两位小数'})
 assert.equal(d.rateToPercentInput(7000),'70');assert.equal(d.rateToPercentInput(6250),'62.5')
 assert.equal(d.discountText(3800),'3.8折');assert.equal(d.discountText(0),'');assert.equal(d.discountText(null),'')
 assert.equal(d.percentText(150),'1.5%');assert.equal(d.percentText(null),'')
})

test('single-rate body always names the action',()=>{
 assert.deepEqual(d.readCommissionForm({action:'set',percent:'70',reason:'合作约定'}),{body:{action:'set',rate:7000,reason:'合作约定'}})
 assert.deepEqual(d.readCommissionForm({action:'remove',percent:'70',reason:' 合作结束 '}),{body:{action:'remove',reason:'合作结束'}})
 assert.equal(d.readCommissionForm({action:'set',percent:'70',reason:'a'}).error,'请填写2至300字调整原因')
 assert.equal(d.readCommissionForm({action:'remove',reason:'a'}).error,'请填写2至300字调整原因')
 assert.equal(d.readCommissionForm({action:'set',percent:'95',reason:'合作约定'}).error,'单独比例须为0%至90%')
 assert.equal(d.readVoidForm({reason:'a'}).error,'请填写2至300字作废原因')
 assert.deepEqual(d.readVoidForm({reason:' 重复登记 '}),{body:{reason:'重复登记'}})
})

test('tier choice always names the mode',()=>{
 assert.deepEqual(d.readTierChoice(profile,{mode:'blocked'}).body,{mode:'blocked'})
 assert.deepEqual(d.readTierChoice(profile,{mode:'fixed',tier:2}).body,{mode:'fixed',tier:2})
 assert.deepEqual(d.readTierChoice({...profile,mode:'fixed',tier:2},{mode:'auto'}).body,{mode:'auto'})
 assert.equal(d.readTierChoice(profile,{mode:'fixed',tier:0}).error,'请选择第1至第3档')
 assert.equal(d.readTierChoice(profile,{}).error,'请选择按加盟款自动定档、手动指定档位或停用拿货')
 assert.equal(d.readTierChoice(profile,{mode:'auto'}).error,'和现在的设置一样，不用保存')
 assert.equal(d.readTierChoice({...profile,mode:'fixed',tier:2},{mode:'fixed',tier:2}).error,'和现在的设置一样，不用保存')
 assert.equal(d.readTierChoice({...profile,applicationState:'pending',mode:'blocked'},{mode:'auto'}).error,'请先由用户申请分销商并审核通过，再设置拿货档位')
 assert.deepEqual(d.readTierChoice({...profile,applicationState:'pending'},{mode:'blocked'}).body,{mode:'blocked'})
 assert.equal(d.tierChoiceText(profile,'fixed',2),'手动指定 · 第二档 金卡（2.8折）')
 assert.equal(d.tierChoiceText(profile,'blocked'),'停用拿货（仍可推广）')
 assert.equal(d.tierChoiceText(profile,'auto'),'按加盟款自动定档（第一档 银卡 3.8折）')
 assert.equal(d.tierChoiceText({...profile,feeTotal:0},'auto'),'按加盟款自动定档（加盟款未满第一档，暂不能拿货）')
 assert.equal(d.currentTierText(profile),'按加盟款自动定档（第一档 银卡 3.8折）')
})

test('downgrade detection',()=>{
 assert.equal(d.isDowngrade(profile,'fixed',3),false)
 assert.equal(d.isDowngrade(profile,'blocked'),true)
 assert.equal(d.isDowngrade({...profile,tier:3,rate:2200,mode:'fixed'},'auto'),true)
 assert.equal(d.isDowngrade({...profile,enabled:false},'blocked'),false)
})

test('duplicate warning within 10 minutes only',()=>{
 const at=m=>{const t=new Date(NOW-m*60000+8*3600000).toISOString();return t.slice(0,10)+' '+t.slice(11,16)}
 const rec=(m,x={})=>({amount:1980000,state:'valid',createdBy:'boss（小程序）',createdAt:at(m),...x})
 assert.equal(d.recentDuplicate([rec(5)],1980000,NOW),'10 分钟内已登记过一笔 ¥19,800.00（boss（小程序）），请确认不是重复登记。')
 assert.equal(d.recentDuplicate([rec(11)],1980000,NOW),'')
 assert.equal(d.recentDuplicate([rec(5,{state:'voided'})],1980000,NOW),'')
 assert.equal(d.recentDuplicate([rec(5)],100,NOW),'')
 assert.equal(d.recentDuplicate([rec(5)],0,NOW),'')
 assert.equal(d.recentDuplicate(null,1980000,NOW),'')
})

test('confirmation texts name the person, member number and amount',()=>{
 assert.equal(d.memberLabel({memberId:88,realName:'王推广',phoneTail:'5555'}),'王推广（会员编号 88，手机尾号 5555）')
 assert.equal(d.memberLabel({memberId:9,nickname:'新朋友'}),'新朋友（会员编号 9）')
 assert.equal(d.feeConfirmText(member,{amount:1980000,method:'bank',paidAt:'2026-09-26 14:30'}),'给王推广（会员编号 88，手机尾号 5555）登记加盟款 ¥19,800.00，收款方式：银行转账，收款时间：2026-09-26 14:30。登记后按加盟款重新确定拿货档位，确认登记？')
 assert.equal(d.feeRetryConfirmText({amount:1980000}),'再次提交同一笔登记（¥19,800.00）？如果上次已经登记成功，这次不会重复计入。')
 assert.equal(d.voidConfirmText(member,detail.fees.records[0],profile),'作废王推广（会员编号 88，手机尾号 5555） 2026-09-20 14:30 收到的加盟款 ¥19,800.00？作废后累计加盟款变为 ¥0.00，拿货档位可能下降，未付款的拿货单会被取消。作废后不能恢复。')
 assert.equal(d.tierConfirmText(member,profile,{mode:'blocked'}),'把王推广（会员编号 88，手机尾号 5555）的拿货方式从「按加盟款自动定档（第一档 银卡 3.8折）」改为「停用拿货（仍可推广）」？档位下降或停用后，未付款的拿货单会被自动取消。')
 assert.equal(d.tierConfirmText(member,profile,{mode:'fixed',tier:2}),'把王推广（会员编号 88，手机尾号 5555）的拿货方式从「按加盟款自动定档（第一档 银卡 3.8折）」改为「手动指定 · 第二档 金卡（2.8折）」？')
 assert.equal(d.commissionConfirmText(member,{action:'set',rate:7000,reason:'合作约定'},detail),'把王推广（会员编号 88，手机尾号 5555）的零售佣金单独比例设为 70%？只对之后的新订单生效。')
 assert.equal(d.commissionConfirmText(member,{action:'remove',reason:'合作结束'},{...detail,commission:{...detail.commission,single:{rate:7000}}}),'取消王推广（会员编号 88，手机尾号 5555）的单独比例 70%？取消后零售佣金按拿货档位 62%，只对之后的新订单生效。')
})

test('fee preview explains the tier after registering',()=>{
 assert.equal(d.feePreview(profile,3000000),'登记后累计 ¥49,800.00，按加盟款可享 2.8折。')
 assert.equal(d.feePreview({...profile,feeTotal:0},100),'登记后累计 ¥1.00，还没满第一档，暂不能拿货。')
 assert.equal(d.feePreview({...profile,mode:'fixed'},100),'这位分销商是手动指定档位，登记后累计 ¥19,801.00，折扣不变。')
 assert.equal(d.feePreview({...profile,mode:'blocked'},0),'这位分销商已停用拿货，登记后累计 ¥19,800.00，仍不能拿货。')
 assert.equal(d.feePreview({...profile,applicationState:'pending'},0),'推广资格审核通过后，才按加盟款定拿货档位。登记后累计 ¥19,800.00。')
})

test('operator texts carry no technical words',()=>{
 const bad=/接口|参数|同步|错误码|字段|配置|token|null|undefined|NaN|[A-Za-z]{3,}/
 const texts=[...d.DISTRIBUTOR_FILTERS.map(f=>f.label),...d.FEE_METHODS.map(m=>m[1]),...d.TIER_MODES.map(m=>m[1]),...Object.values(d.DISTRIBUTOR_UNCERTAIN),...Object.values(d.DISTRIBUTOR_DONE),
  d.phoneText({}),d.displayName({}),d.applicationText('x'),d.tierStatus({}).source,d.tierStatus({applicationState:'approved'}).next,d.commissionText({source:'none'}),d.afterRemoveText({})]
 for(const t of texts)assert.doesNotMatch(t,bad,t)
})
