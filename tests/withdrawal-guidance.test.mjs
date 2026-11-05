import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/withdrawal-guidance.js',import.meta.url),'utf8')
const {withdrawalGuidance,commissionDebt,withdrawalRuleRows}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

test('published withdrawal rules follow current limits, fees and review days, even with no available commission',()=>{
 const distribution={available:0,withdrawalMaxAmount:20000,distributorServiceRate:100}
 const rules={withdrawMinimum:0,withdrawFee:0,withdrawTaxRate:1300,withdrawWorkingDays:3}
 const rows=Object.fromEntries(withdrawalRuleRows(distribution,rules).map(row=>[row.key,row.text]))
 assert.match(rows.amount,/不设商家最低申请金额/);assert.match(rows.amount,/¥0.10 至 ¥200.00/)
 assert.match(rows.count,/每日申请次数不设固定上限/);assert.match(rows.count,/额度允许后.*审核/);assert.match(rows.count,/商家设置的每人每日到账限额/);assert.doesNotMatch(rows.count,/单笔到账金额超过/);assert.doesNotMatch(rows.count,/次日|明天|第二天/)
 assert.match(rows.hours,/00:00–24:00/);assert.match(rows.review,/3 个工作日/)
 assert.match(rows.fees,/手续费 ¥0.00；代扣税费 13%；平台服务费 1%/)
 assert.match(rows.arrival,/确认收款/);assert.match(rows.confirmation,/24 小时/)
 const changed=Object.fromEntries(withdrawalRuleRows({...distribution,withdrawalMaxAmount:50000},{...rules,withdrawMinimum:1000,withdrawFee:200,withdrawTaxRate:1250,withdrawWorkingDays:5,distributorServiceRate:0}).map(row=>[row.key,row.text]))
 assert.match(changed.amount,/每笔申请至少 ¥10.00/);assert.match(changed.amount,/¥500.00/)
 assert.match(changed.review,/5 个工作日/);assert.doesNotMatch(changed.review,/3 个工作日/)
 assert.match(changed.fees,/手续费 ¥2.00；代扣税费 12.5%；平台服务费 0%/)
})

test('missing withdrawal configuration does not invent an upper limit, zero fees or a review deadline',()=>{
 const rows=Object.fromEntries(withdrawalRuleRows({available:0},{}).map(row=>[row.key,row.text]))
 assert.match(rows.amount,/单笔上限暂未加载/);assert.match(rows.review,/审核时限暂未加载/)
 assert.match(rows.fees,/费用规则暂未加载完整/)
 assert.doesNotMatch(JSON.stringify(rows),/NaN|undefined|¥200.00|3 个工作日|手续费 ¥0.00/)
})

test('paid orders waiting for receipt explain the actual pending balance and withdrawal gap',()=>{
 const state=withdrawalGuidance({available:0,lineRewards:[{amount:5424,available_amount:0,wait_days:15,reason:'等待实际收货'},{amount:0,available_amount:0,wait_days:15,reason:'退款已扣回'}]},{withdrawMinimum:10000})
 assert.equal(state.title,'为什么暂时不能提现？')
 assert.deepEqual(state.breakdown,[{key:'receipt',label:'等待客户收货',amount:5424}])
 assert.match(state.settlement,/收货后还需结算 15 天/)
 assert.match(state.threshold,/满 ¥100.00/);assert.match(state.threshold,/还差 ¥100.00/)
 assert.doesNotMatch(state.threshold,/45.76/)
})
test('partially settled rewards and after-sales show only amounts still unavailable',()=>{
 const state=withdrawalGuidance({available:2000,lineRewards:[{amount:6000,available_amount:2000,wait_days:7,reason:'等待收货后结算期'},{amount:900,available_amount:0,wait_days:15,reason:'相关商品售后处理中'}]},{withdrawMinimum:5000})
 assert.equal(state.pending,4900);assert.equal(state.breakdown[0].amount,4000)
 assert.equal(state.breakdown[1].label,'售后处理中')
 assert.match(state.settlement,/7、15 天/);assert.match(state.threshold,/还差 ¥30.00/)
})
test('enough available commission is not labelled as unable to withdraw despite pending orders',()=>{
 const state=withdrawalGuidance({available:20000,lineRewards:[{amount:1000,available_amount:0,wait_days:15,reason:'等待实际收货'}]},{withdrawMinimum:10000})
 assert.equal(state.title,'佣金结算与提现说明');assert.doesNotMatch(state.threshold,/还差/)
})
test('zero-day and absent settlement periods never fall back to an invented fifteen days',()=>{
 const immediate=withdrawalGuidance({available:0,lineRewards:[{amount:100,available_amount:0,wait_days:0,reason:'等待实际收货'}]},{withdrawMinimum:100})
 assert.match(immediate.settlement,/售后核对完成后/);assert.doesNotMatch(immediate.settlement,/15/)
 const legacy=withdrawalGuidance({available:0,commission:[{amount:100,status:'pending',ready_at:null}]},{withdrawMinimum:100})
 assert.equal(legacy.pending,100);assert.match(legacy.settlement,/具体时间/);assert.doesNotMatch(legacy.settlement,/15/)
})
test('existing pending applications and refunds are explained without blaming unreceived orders',()=>{
 const reserved=withdrawalGuidance({available:0,withdrawals:[{amount:10000,status:'pending'},{amount:20000,status:'paid'}]},{withdrawMinimum:0})
 assert.equal(reserved.title,'已有提现申请处理中');assert.match(reserved.reserved,/¥100.00/)
 const debt=withdrawalGuidance({available:-2500},{withdrawMinimum:10000})
 assert.equal(debt.title,'退款佣金待抵扣');assert.match(debt.debt,/¥25.00/);assert.doesNotMatch(debt.threshold,/还差/)
})
test('missing data and reversed legacy commission do not fabricate amounts or settlement dates',()=>{
 const state=withdrawalGuidance({commission:[{status:'reversed',amount:1000}],lineRewards:[{amount:'invalid',available_amount:0}]},{})
 assert.equal(state.pending,0);assert.deepEqual(state.breakdown,[])
 assert.doesNotMatch(JSON.stringify(state),/NaN|undefined|100\.00|15 天/)
})
test('withdrawals still in progress are not counted as refund commission owed',()=>{
 const inFlight={available:-13081,withdrawals:[{amount:10000,status:'pending'},{amount:5000,status:'rejected'},{amount:20000,status:'paid'}]}
 assert.equal(commissionDebt(inFlight),3081)
 const state=withdrawalGuidance(inFlight,{withdrawMinimum:10000})
 assert.equal(state.title,'退款佣金待抵扣');assert.match(state.debt,/¥30\.81/);assert.doesNotMatch(state.debt,/130\.81/)
 assert.match(state.reserved,/¥100\.00/);assert.match(state.reserved,/驳回/)
 const coveredByWithdrawal={available:-3000,withdrawals:[{amount:10000,status:'unknown'}]}
 assert.equal(commissionDebt(coveredByWithdrawal),0)
 const covered=withdrawalGuidance(coveredByWithdrawal,{withdrawMinimum:10000})
 assert.equal(covered.debt,'');assert.equal(covered.title,'已有提现申请处理中');assert.match(covered.reserved,/暂时不能审核到账/)
 assert.equal(commissionDebt({available:-2500}),2500);assert.equal(commissionDebt({available:500}),0);assert.equal(commissionDebt(null),0);assert.equal(commissionDebt({available:'bad'}),0)
 assert.doesNotMatch(withdrawalGuidance({available:0,withdrawals:[{amount:10000,status:'pending'}]},{}).reserved,/驳回/)
})
