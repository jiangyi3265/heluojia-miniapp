import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
const amountUrl=dataUrl(readFileSync(new URL('../services/withdrawal-amount.js',import.meta.url),'utf8'))
const source=readFileSync(new URL('../services/distribution-statement.js',import.meta.url),'utf8')
assert.ok(source.includes("from './withdrawal-amount.js'"))
const {monthOf,shiftMonth,monthLabel,monthChoices,readStatement,statementHasRecords,statementServiceRate,serviceFeeExplanation,statementError}=await import(dataUrl(source.replace("from './withdrawal-amount.js'",`from '${amountUrl}'`)))

// Exactly what GET /shop/app/distribution/statements returns (ShopPlatformFees.ownStatement -> distributorDetail):
// totals at the top level (withdrawals is a count), rewardEvents with `time`, withdrawalRecords with camelCase amounts.
function serverReply(){return {
 month:'2026-08',memberId:7,commissionGenerated:12000,commissionClawedBack:2000,withdrawals:2,withdrawnGross:15000,serviceFee:150,taxWithheld:3000,withdrawFee:200,netPaid:11650,
 rewardEvents:[
  {id:11,time:'2026-08-02 10:00:00',orderNo:'NO1',itemName:'修护精华',kind:'佣金产生',amount:12000,note:'付款生成佣金'},
  {id:12,time:'2026-08-05 10:00:00',orderNo:'NO1',itemName:'修护精华',kind:'退款扣回',amount:-2000,note:'退款扣回'}],
 withdrawalRecords:[
  {id:9,createdAt:'2026-08-18 09:00:00',handledAt:'2026-08-20 09:00:00',amount:10000,withdrawFee:100,taxWithheld:2000,taxRate:2000,serviceFee:100,serviceRate:100,netPaid:7800,transferBillNo:'T9'},
  {id:10,createdAt:'2026-08-25 09:00:00',handledAt:'2026-08-26 09:00:00',amount:5000,withdrawFee:100,taxWithheld:1000,taxRate:2000,serviceFee:50,serviceRate:100,netPaid:3850,transferBillNo:'T10'}],
 basis:'佣金产生和退款扣回按发生时间统计，只算正式付款订单；提现只算本月微信已到账的零钱提现。',
 months:['2026-09','2026-08']}}

test('months follow China time and step across years',()=>{
 // 2026-09-30 17:00 UTC is already 1 October in China
 assert.equal(monthOf(new Date('2026-09-30T17:00:00Z')),'2026-10')
 assert.equal(monthOf(new Date('2026-09-30T15:00:00Z')),'2026-09')
 assert.equal(shiftMonth('2026-01',-1),'2025-12')
 assert.equal(shiftMonth('2026-12',1),'2027-01')
 assert.equal(shiftMonth('2026-03',-14),'2025-01')
 assert.equal(shiftMonth('bad',1),'')
 assert.equal(monthLabel('2026-09'),'2026 年 9 月')
 assert.equal(monthLabel('2026-13'),'')
})
test('month choices offer the last 12 months newest first and mark months with records',()=>{
 const now=new Date('2026-09-24T04:00:00Z')
 const choices=monthChoices(['2026-08',{month:'2026-03'},'2025-01','junk'],now)
 assert.equal(choices[0].month,'2026-09')
 assert.equal(choices[11].month,'2025-10')
 // an older month the server reports is kept at the end
 assert.equal(choices.length,13)
 assert.equal(choices[12].month,'2025-01')
 assert.equal(choices.find(c=>c.month==='2026-08').label,'2026 年 8 月 · 有记录')
 assert.equal(choices.find(c=>c.month==='2026-03').active,true)
 assert.equal(choices.find(c=>c.month==='2026-07').label,'2026 年 7 月')
 assert.equal(monthChoices(undefined,now).length,12)
})
test('the current month is only marked as having records once its own statement shows some',()=>{
 const now=new Date('2026-09-24T04:00:00Z')
 // the server always lists the current month, even when nothing happened in it
 let choices=monthChoices(['2026-09','2026-08'],now)
 assert.equal(choices[0].month,'2026-09')
 assert.equal(choices[0].label,'2026 年 9 月')
 assert.equal(choices[0].active,false)
 assert.equal(choices.find(c=>c.month==='2026-08').label,'2026 年 8 月 · 有记录')
 // after reading this month's statement the page knows the answer
 choices=monthChoices(['2026-09','2026-08'],now,{'2026-09':true})
 assert.equal(choices[0].label,'2026 年 9 月 · 有记录')
 assert.equal(monthChoices(['2026-09'],now,{'2026-09':false})[0].label,'2026 年 9 月')
 // a month read and found empty is not marked, one read with records is marked even if the list missed it
 choices=monthChoices(['2026-08'],now,{'2026-08':false,'2026-07':true,'junk':true})
 assert.equal(choices.find(c=>c.month==='2026-08').active,false)
 assert.equal(choices.find(c=>c.month==='2026-07').label,'2026 年 7 月 · 有记录')
 assert.equal(choices.length,12)
 assert.equal(monthChoices(['2026-08'],now,null).find(c=>c.month==='2026-08').active,true)
})
test('a statement has records when anything changed or arrived in the month',()=>{
 assert.equal(statementHasRecords(readStatement(serverReply(),'2026-08')),true)
 const quiet={month:'2026-09',memberId:7,commissionGenerated:0,commissionClawedBack:0,withdrawals:0,withdrawnGross:0,serviceFee:0,taxWithheld:0,withdrawFee:0,netPaid:0,rewardEvents:[],withdrawalRecords:[],months:['2026-09']}
 assert.equal(statementHasRecords(readStatement(quiet,'2026-09')),false)
 assert.equal(statementHasRecords(readStatement({...quiet,commissionClawedBack:500},'2026-09')),true)
 assert.equal(statementHasRecords(readStatement({...quiet,withdrawals:1},'2026-09')),true)
 assert.equal(statementHasRecords(null),false)
})
test('reads the reply the server actually sends: withdrawals listed with their own deductions, dated commission changes',()=>{
 const s=readStatement(serverReply(),'2026-08')
 assert.equal(s.month,'2026-08')
 assert.deepEqual(s.months,['2026-09','2026-08'])
 assert.deepEqual(s.summary,{commissionGenerated:12000,commissionClawedBack:2000,withdrawals:2,withdrawnGross:15000,withdrawFee:200,serviceFee:150,taxWithheld:3000,netPaid:11650,availableAtMonthEnd:null,commissionNet:10000})
 // the count above and the list below agree
 assert.equal(s.withdrawals.length,s.summary.withdrawals)
 assert.deepEqual(s.withdrawals[0],{amount:10000,fee:100,tax:2000,rate:2000,service:100,serviceRate:100,received:7800,id:9,at:'2026-08-20 09:00:00',state:''})
 assert.deepEqual(s.withdrawals[1],{amount:5000,fee:100,tax:1000,rate:2000,service:50,serviceRate:100,received:3850,id:10,at:'2026-08-26 09:00:00',state:''})
 // every line adds up: 到账 = 申请 − 手续费 − 平台服务费 − 代扣税费, and the lines add up to the totals
 for(const w of s.withdrawals)assert.equal(w.received,w.amount-w.fee-w.service-w.tax)
 for(const [line,total] of [['amount','withdrawnGross'],['fee','withdrawFee'],['service','serviceFee'],['tax','taxWithheld'],['received','netPaid']])assert.equal(s.withdrawals.reduce((sum,w)=>sum+w[line],0),s.summary[total])
 assert.deepEqual(s.events,[{id:11,delta:12000,note:'付款生成佣金',orderNo:'NO1',at:'2026-08-02 10:00:00'},{id:12,delta:-2000,note:'退款扣回',orderNo:'NO1',at:'2026-08-05 10:00:00'}])
})
test('with the server reply, 平台服务费 shows the rate locked on the withdrawals, not a later rule',()=>{
 const s=readStatement(serverReply(),'2026-08')
 assert.equal(statementServiceRate(s,{distributorServiceRate:300}),100)
 assert.equal(serviceFeeExplanation(statementServiceRate(s,{distributorServiceRate:300})),'按提现申请金额的 1% 收取，提现时直接扣除，不足 1 分的部分不收。')
})
test('with the server reply and no totals, the worked-out totals use each withdrawal\'s own deductions',()=>{
 const reply=serverReply()
 for(const key of ['commissionGenerated','commissionClawedBack','withdrawals','withdrawnGross','serviceFee','taxWithheld','withdrawFee','netPaid'])delete reply[key]
 const s=readStatement(reply,'2026-08')
 assert.deepEqual(s.summary,{commissionGenerated:12000,commissionClawedBack:2000,withdrawals:2,withdrawnGross:15000,withdrawFee:200,serviceFee:150,taxWithheld:3000,netPaid:11650,availableAtMonthEnd:null,commissionNet:10000})
})
test('a withdrawal without its arrived amount has it worked out from its deductions',()=>{
 const reply=serverReply();delete reply.withdrawalRecords[0].netPaid
 assert.equal(readStatement(reply,'2026-08').withdrawals[0].received,7800)
 // a withdrawal that paid a service fee of 0 on a tiny amount still carries its locked rate
 const tiny=readStatement({withdrawalRecords:[{id:1,amount:99,withdrawFee:0,taxWithheld:0,taxRate:0,serviceFee:0,serviceRate:100,netPaid:99,handledAt:'2026-08-01 10:00:00'}]},'2026-08')
 assert.deepEqual(tiny.withdrawals[0],{amount:99,fee:0,tax:0,rate:0,service:0,serviceRate:100,received:99,id:1,at:'2026-08-01 10:00:00',state:''})
 assert.equal(statementServiceRate(tiny,{distributorServiceRate:300}),100)
})
test('withdrawals made before the platform service fee applied do not show the current rate',()=>{
 const reply=serverReply()
 for(const w of reply.withdrawalRecords){w.netPaid+=w.serviceFee;w.serviceFee=0;w.serviceRate=0}
 reply.serviceFee=0;reply.netPaid=11800
 const s=readStatement(reply,'2026-08')
 assert.equal(s.summary.netPaid,11800)
 assert.equal(s.withdrawals[0].received,7900)
 assert.equal(statementServiceRate(s,{distributorServiceRate:100}),null)
 // one old withdrawal without the fee and one new one with it: no single rate to claim
 const mixed=serverReply();mixed.withdrawalRecords[1].serviceFee=0;mixed.withdrawalRecords[1].serviceRate=0
 assert.equal(statementServiceRate(readStatement(mixed,'2026-08'),{distributorServiceRate:100}),null)
 // no withdrawals in the month: the current rule explains how the fee is charged
 assert.equal(statementServiceRate(readStatement({withdrawalRecords:[]},'2026-08'),{distributorServiceRate:100}),100)
})
test('reads a flat statement with detail lists',()=>{
 const s=readStatement({month:'2026-08',months:['2026-08'],memberId:7,commissionGenerated:12000,commissionClawedBack:2000,withdrawals:1,withdrawnGross:10000,serviceFee:100,taxWithheld:2000,withdrawFee:100,netPaid:7800,availableAtMonthEnd:3500,
  events:[{id:1,delta:12000,note:'付款生成佣金',order_no:'NO1',created_at:'2026-08-02 10:00:00'},{id:2,delta:-2000,note:'退款扣回',order_no:'NO1',created_at:'2026-08-05 10:00:00'},{id:3,delta:0,available_delta:10000,note:'结算完成'}],
  withdrawalRows:[{id:9,amount:10000,fee:100,tax_amount:2000,tax_rate:2000,service_fee:100,service_rate:100,received_amount:7800,status:'paid',handled_at:'2026-08-20 09:00:00'}]},'2026-08')
 assert.equal(s.month,'2026-08')
 assert.deepEqual(s.months,['2026-08'])
 assert.deepEqual(s.summary,{commissionGenerated:12000,commissionClawedBack:2000,withdrawals:1,withdrawnGross:10000,withdrawFee:100,serviceFee:100,taxWithheld:2000,netPaid:7800,availableAtMonthEnd:3500,commissionNet:10000})
 // a change that only moves pending commission to withdrawable is not a commission change
 assert.equal(s.events.length,2)
 assert.deepEqual(s.events[1],{id:2,delta:-2000,note:'退款扣回',orderNo:'NO1',at:'2026-08-05 10:00:00'})
 assert.equal(s.withdrawals[0].service,100)
 assert.equal(s.withdrawals[0].received,7800)
 assert.equal(s.withdrawals[0].at,'2026-08-20 09:00:00')
})
test('reads a nested statement with snake_case names and a withdrawals list under detail',()=>{
 const s=readStatement({month:'2026-07',statement:{commission_generated:500,commission_clawed_back:-100,withdrawals:2,withdrawn_gross:3000,service_fee:30,tax_withheld:0,withdraw_fee:0,net_paid:2970},detail:{events:[],withdrawals:[{id:1,amount:1000,service_fee:10,service_rate:100,status:'paid'},{id:2,amount:2000,service_fee:20,service_rate:100,status:'paid'}]}},'2026-07')
 assert.equal(s.summary.commissionClawedBack,100)
 assert.equal(s.summary.commissionNet,400)
 assert.equal(s.summary.withdrawals,2)
 assert.equal(s.summary.netPaid,2970)
 assert.equal(s.summary.availableAtMonthEnd,null)
 assert.equal(s.withdrawals.length,2)
 assert.equal(statementServiceRate(s,{distributorServiceRate:300}),100)
})
test('missing totals are worked out from the lists, counting only withdrawals that arrived',()=>{
 const s=readStatement({events:[{delta:800},{delta:'-300'},{delta:200}],withdrawals:[
  {id:1,amount:10000,fee:100,tax_amount:2000,service_fee:100,status:'paid'},
  {id:2,amount:5000,fee:100,tax_amount:1000,service_fee:50,status:'pending'}]},'2026-06')
 assert.equal(s.month,'2026-06')
 assert.deepEqual(s.summary,{commissionGenerated:1000,commissionClawedBack:300,withdrawals:1,withdrawnGross:10000,withdrawFee:100,serviceFee:100,taxWithheld:2000,netPaid:7800,availableAtMonthEnd:null,commissionNet:700})
 assert.equal(s.withdrawals.length,2)
})
test('an empty or odd reply still gives a zero statement for the month asked',()=>{
 for(const reply of [undefined,null,{},[],'text']){
  const s=readStatement(reply,'2026-05')
  assert.equal(s.month,'2026-05')
  assert.equal(s.summary.netPaid,0)
  assert.equal(s.summary.withdrawals,0)
  assert.deepEqual(s.events,[])
  assert.deepEqual(s.withdrawals,[])
 }
 assert.equal(readStatement({month:'garbage'},'2026-05').month,'2026-05')
})
test('service fee rate shown comes from locked withdrawals, then the statement, then current rules',()=>{
 assert.equal(statementServiceRate({withdrawals:[{service:100,serviceRate:100},{service:50,serviceRate:100}]},{distributorServiceRate:300}),100)
 // different locked rates within the month: do not claim one rate
 assert.equal(statementServiceRate({withdrawals:[{service:100,serviceRate:100},{service:150,serviceRate:150}]},{distributorServiceRate:300}),null)
 assert.equal(statementServiceRate({withdrawals:[],serviceRate:200},{distributorServiceRate:300}),200)
 assert.equal(statementServiceRate({withdrawals:[]},{distributorServiceRate:100}),100)
 assert.equal(statementServiceRate({withdrawals:[]},{}),null)
 assert.equal(serviceFeeExplanation(100),'按提现申请金额的 1% 收取，提现时直接扣除，不足 1 分的部分不收。')
 assert.match(serviceFeeExplanation(null),/以提现记录为准/)
})
test('server errors are shown in plain words',()=>{
 assert.equal(statementError(Error('请先登录')),'请先登录')
 assert.equal(statementError(Error("请求地址'/shop/app/distribution/statements',不存在")),'结算单暂时打不开，请稍后再试。')
 assert.equal(statementError(Error('NullPointerException')),'结算单暂时打不开，请稍后再试。')
 assert.equal(statementError(null),'结算单暂时打不开，请稍后再试。')
 assert.equal(statementError(Error('无法连接服务，请检查网络后重试')),'无法连接服务，请检查网络后重试')
})
