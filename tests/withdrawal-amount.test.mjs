import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/withdrawal-amount.js',import.meta.url),'utf8')
const {withdrawalTax,withdrawalServiceFee,distributorServiceRate,taxRateText,rateText,withdrawalBreakdown,deductionText,withdrawalFeeNote,withdrawalAmountProblem,previewReceived,largestWithdrawal,withdrawalRecordAmounts}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

test('tax is withheld on the pre-tax amount and rounded down to the cent',()=>{
 assert.equal(withdrawalTax(10000,2000),2000)
 assert.equal(withdrawalTax(10001,2000),2000)
 assert.equal(withdrawalTax(12345,1250),1543)
 assert.equal(withdrawalTax(99,100),0)
 assert.equal(withdrawalTax(10000,0),0)
 assert.equal(withdrawalTax(10000,undefined),0)
})
test('platform service fee is 1% of the requested amount, rounded down to the cent like the server',()=>{
 assert.equal(withdrawalServiceFee(10000,100),100)
 assert.equal(withdrawalServiceFee(10099,100),100)
 assert.equal(withdrawalServiceFee(99,100),0)
 assert.equal(withdrawalServiceFee(12345,100),123)
 assert.equal(withdrawalServiceFee(10000,undefined),0)
})
test('service rate prefers the bootstrap rules and falls back to the distribution summary',()=>{
 assert.equal(distributorServiceRate({distributorServiceRate:100},{distributorServiceRate:300}),100)
 assert.equal(distributorServiceRate({},{distributorServiceRate:300}),300)
 assert.equal(distributorServiceRate({distributorServiceRate:null},{distributorServiceRate:300}),300)
 // a rate saved as 0 in the rules is a real setting, not a missing value
 assert.equal(distributorServiceRate({distributorServiceRate:0},{distributorServiceRate:300}),0)
 assert.equal(distributorServiceRate({},{}),0)
 assert.equal(distributorServiceRate(undefined,undefined),0)
 assert.equal(distributorServiceRate({distributorServiceRate:'abc'},{}),0)
})
test('rate text shows percent without trailing zeros',()=>{
 assert.equal(taxRateText(2000),'20%');assert.equal(taxRateText(1250),'12.5%');assert.equal(taxRateText(5),'0.05%');assert.equal(taxRateText(0),'0%')
 assert.equal(rateText(100),'1%')
})
test('net amount subtracts fee, service fee and tax; missing rates mean no deduction',()=>{
 assert.deepEqual(withdrawalBreakdown(10000,{withdrawFee:100,withdrawTaxRate:2000}),{amount:10000,fee:100,rate:2000,tax:2000,serviceRate:0,service:0,net:7900})
 assert.deepEqual(withdrawalBreakdown(10000,{withdrawFee:100}),{amount:10000,fee:100,rate:0,tax:0,serviceRate:0,service:0,net:9900})
 assert.deepEqual(withdrawalBreakdown(10000,{withdrawFee:100,withdrawTaxRate:2000,distributorServiceRate:100}),{amount:10000,fee:100,rate:2000,tax:2000,serviceRate:100,service:100,net:7800})
 assert.deepEqual(withdrawalBreakdown(12345,{withdrawFee:0,distributorServiceRate:100}),{amount:12345,fee:0,rate:0,tax:0,serviceRate:100,service:123,net:12222})
})
test('deduction wording names only what the amount pays',()=>{
 assert.equal(deductionText({fee:0,service:0,tax:0}),'')
 assert.equal(deductionText({fee:0,service:0,tax:5}),'代扣税费')
 assert.equal(deductionText({fee:0,service:5,tax:0}),'平台服务费')
 assert.equal(deductionText({fee:0,service:5,tax:5}),'平台服务费和代扣税费')
 assert.equal(deductionText({fee:2,service:5,tax:5}),'手续费、平台服务费和代扣税费')
})
test('fee note explains each applicable deduction in plain words',()=>{
 assert.equal(withdrawalFeeNote({}),'')
 assert.equal(withdrawalFeeNote({withdrawTaxRate:2000}),'代扣税费按提现申请金额（税前）的 20% 计算，不足 1 分的部分不扣，由公司代为申报缴纳。预计到账 = 申请金额 − 代扣税费。')
 assert.equal(withdrawalFeeNote({distributorServiceRate:100}),'平台服务费按提现申请金额的 1% 收取，不足 1 分的部分不收。预计到账 = 申请金额 − 平台服务费。')
 assert.match(withdrawalFeeNote({withdrawFee:2,distributorServiceRate:100,withdrawTaxRate:2000}),/平台服务费按提现申请金额的 1% 收取.*代扣税费按.*20%.*预计到账 = 申请金额 − 手续费 − 平台服务费 − 代扣税费。$/)
})

test('no merchant minimum permits small settled balances but keeps the WeChat net minimum',()=>{
 const rules={withdrawMinimum:0,withdrawFee:0,withdrawTaxRate:1300,distributorServiceRate:100}
 assert.equal(withdrawalAmountProblem(5424,{rules,available:5424}), '')
 assert.equal(previewReceived(5424,{rules,available:5424}),4665)
 assert.equal(previewReceived(100,{rules,available:100}),86)
 assert.equal(previewReceived(11,{rules,available:11}),10)
 assert.equal(previewReceived(10,{rules,available:10}),null)
 assert.equal(withdrawalAmountProblem(10,{rules,available:10}),'扣除代扣税费后，到账金额至少 ¥0.10')
 assert.equal(withdrawalAmountProblem(1,{rules,available:1}),'到账金额至少 ¥0.10')
 assert.equal(withdrawalAmountProblem(100,{rules,available:0}),'金额超过当前可提现佣金')
 assert.equal(withdrawalAmountProblem(0,{rules,available:100}),'请输入大于 0 的提现金额')
 assert.equal(withdrawalAmountProblem(100,{rules,available:100,maximum:50}),'单笔到账金额超过限额，请调整金额')
 assert.equal(withdrawalRecordAmounts({amount:10000,fee:200,tax_amount:1300,service_fee:100}).received,8400)
})
test('validation covers minimum, fee plus tax, balance, 0.10 floor and transfer maximum',()=>{
 const rules={withdrawMinimum:100,withdrawFee:50,withdrawTaxRate:2000}
 assert.equal(withdrawalAmountProblem(99,{rules,available:100000}),'金额未达到最低提现要求')
 // 60 - 50 - 12 < 0
 assert.equal(withdrawalAmountProblem(60,{rules:{...rules,withdrawMinimum:1},available:100000}),'提现金额需要高于手续费和代扣税费')
 assert.equal(withdrawalAmountProblem(50,{rules:{withdrawMinimum:1,withdrawFee:50},available:100000}),'提现金额需要高于手续费')
 assert.equal(withdrawalAmountProblem(20000,{rules,available:10000}),'金额超过当前可提现佣金')
 // 70 - 50 - 14 = 6 cents, above zero but under 0.10
 assert.match(withdrawalAmountProblem(70,{rules:{...rules,withdrawMinimum:1},available:100000}),/至少 ¥0.10/)
 // 76 - 50 - 15 = 11 cents
 assert.equal(withdrawalAmountProblem(76,{rules:{...rules,withdrawMinimum:1},available:100000}),'')
 assert.equal(withdrawalAmountProblem(30000,{rules,available:100000,maximum:20000}),'单笔到账金额超过限额，请调整金额')
 assert.equal(withdrawalAmountProblem(25062,{rules,available:100000,maximum:20000}),'')
})
test('validation includes the platform service fee',()=>{
 const rules={withdrawMinimum:1,withdrawFee:50,withdrawTaxRate:2000,distributorServiceRate:100}
 // 100 - 50 - 1 - 20 = 29 cents
 assert.equal(withdrawalAmountProblem(100,{rules,available:100000}),'')
 // 70 - 50 - 0 - 14 = 6 cents; the 0.7 fen service fee rounds down to nothing, so it is not named
 assert.equal(withdrawalAmountProblem(70,{rules,available:100000}),'扣除手续费和代扣税费后，到账金额至少 ¥0.10')
 // 200 - 199 - 2 - 40 < 0; the service fee is named once it is at least 1 分
 assert.equal(withdrawalAmountProblem(200,{rules:{...rules,withdrawFee:199},available:100000}),'提现金额需要高于手续费、平台服务费和代扣税费')
 // 76 - 50 - 0 - 15 = 11 cents: the 1% service fee on 0.76 yuan is under 1 分 and is not charged
 assert.equal(withdrawalAmountProblem(76,{rules,available:100000}),'')
 // 25062 - 50 - 250 - 5012 = 19750 is now under the 20000 maximum; 25400 - 50 - 254 - 5080 = 20016 is over it
 assert.equal(withdrawalAmountProblem(25062,{rules,available:100000,maximum:20000}),'')
 assert.equal(withdrawalAmountProblem(25400,{rules,available:100000,maximum:20000}),'单笔到账金额超过限额，请调整金额')
})
test('largest withdrawal keeps the net within the per-transfer maximum',()=>{
 const rules={withdrawFee:100,withdrawTaxRate:2000}
 assert.equal(largestWithdrawal({available:100000,rules,maximum:20000}),25125)
 assert.equal(withdrawalBreakdown(25125,rules).net,20000)
 assert.equal(withdrawalBreakdown(25126,rules).net,20001)
 assert.equal(largestWithdrawal({available:100000,rules:{withdrawFee:100},maximum:20000}),20100)
 assert.equal(largestWithdrawal({available:5000,rules,maximum:20000}),5000)
 assert.equal(largestWithdrawal({available:5000,rules,maximum:0}),5000)
 assert.equal(largestWithdrawal({available:-300,rules,maximum:20000}),0)
})
test('largest withdrawal includes the platform service fee',()=>{
 const rules={withdrawFee:100,withdrawTaxRate:2000,distributorServiceRate:100}
 const best=largestWithdrawal({available:100000,rules,maximum:20000})
 // the bound floor(20100*10000/7900) = 25443 arrives as 25443 - 100 - 254 - 5088 = 20001, so the search steps down one 分
 assert.equal(best,25442)
 assert.equal(withdrawalBreakdown(25443,rules).net,20001)
 assert.equal(withdrawalBreakdown(best,rules).net,20000)
 assert.ok(withdrawalBreakdown(best+1,rules).net>20000)
 assert.equal(largestWithdrawal({available:100000,rules:{withdrawFee:100,distributorServiceRate:100},maximum:20000}),20303)
 assert.equal(largestWithdrawal({available:5000,rules,maximum:20000}),5000)
 // both rates at their highest: at most 1 分 minus the fee can arrive, so every amount fits
 assert.equal(largestWithdrawal({available:7000,rules:{withdrawTaxRate:5000,distributorServiceRate:5000},maximum:10}),7000)
})
// Independent check: walk every amount up to well past the limit and keep the largest one that fits.
function bruteForceLargest(rules,maximum,limit){let best=0;for(let a=0;a<=limit;a++)if(withdrawalBreakdown(a,rules).net<=maximum)best=a;return best}
test('largest withdrawal matches a brute-force search across rates and fees',()=>{
 for(const rate of [0,1,333,1250,2000,3333,4999,5000])for(const fee of [0,1,99,100])for(const maximum of [10,999,20000]){
  const rules={withdrawFee:fee,withdrawTaxRate:rate},best=largestWithdrawal({available:10**9,rules,maximum})
  assert.ok(withdrawalBreakdown(best,rules).net<=maximum,`rate ${rate} fee ${fee} max ${maximum}`)
  assert.ok(withdrawalBreakdown(best+1,rules).net>maximum,`rate ${rate} fee ${fee} max ${maximum}`)
 }
})
test('largest withdrawal with a service fee matches a brute-force search, including where net steps back',()=>{
 let checked=0,nonMonotonic=0
 for(const rate of [0,1,333,1250,2000,3333,4999,5000])for(const serviceRate of [0,1,100,999,1000,3000])for(const fee of [0,1,99,100])for(const maximum of [10,57,999,2500]){
  const rules={withdrawFee:fee,withdrawTaxRate:rate,distributorServiceRate:serviceRate},kept=10000-rate-serviceRate
  // brute-force limit: twice the bound where even the most favourable rounding cannot fit any more
  const limit=2*Math.ceil((maximum+fee+2)*10000/kept)+50,expected=bruteForceLargest(rules,maximum,limit)
  const label=`tax ${rate} service ${serviceRate} fee ${fee} max ${maximum}`
  assert.equal(largestWithdrawal({available:10**9,rules,maximum}),expected,label)
  assert.equal(largestWithdrawal({available:limit*3,rules,maximum}),expected,label)
  // capped by the balance: the largest fitting amount not above the balance
  const cap=Math.floor(expected/2)+3
  assert.equal(largestWithdrawal({available:cap,rules,maximum}),bruteForceLargest(rules,maximum,cap),label+' cap '+cap)
  for(let a=Math.max(1,expected-40);a<=expected+40;a++)if(withdrawalBreakdown(a,rules).net<withdrawalBreakdown(a-1,rules).net){nonMonotonic++;break}
  checked++
 }
 assert.equal(checked,768)
 // the search space really contains amounts where one more 分 arrives as less money
 assert.ok(nonMonotonic>0)
})
test('records prefer the server received amount and fall back to amount - fee - tax - service fee',()=>{
 assert.deepEqual(withdrawalRecordAmounts({amount:10000,fee:100,tax_amount:2000,tax_rate:2000,received_amount:7900}),{amount:10000,fee:100,tax:2000,rate:2000,service:0,serviceRate:0,received:7900})
 assert.equal(withdrawalRecordAmounts({amount:10000,fee:100,tax_amount:2000}).received,7900)
 assert.deepEqual(withdrawalRecordAmounts({amount:10000,fee:100}),{amount:10000,fee:100,tax:0,rate:0,service:0,serviceRate:0,received:9900})
 assert.deepEqual(withdrawalRecordAmounts({amount:10000,fee:100,tax_amount:2000,tax_rate:2000,service_fee:100,service_rate:100,received_amount:7800}),{amount:10000,fee:100,tax:2000,rate:2000,service:100,serviceRate:100,received:7800})
 assert.equal(withdrawalRecordAmounts({amount:10000,fee:100,tax_amount:2000,service_fee:100}).received,7800)
 assert.equal(withdrawalRecordAmounts({amount:10000,fee:100,tax_amount:2000,service_fee:100,received_amount:''}).received,7800)
})
test('the 预计到账 sent with a request is the shown net, and nothing while the amount has a problem',()=>{
 const rules={withdrawMinimum:100,withdrawFee:100,withdrawTaxRate:2000,distributorServiceRate:100}
 // 100.00 - 1.00 - 20.00 - 1.00 = 78.00, the same amount the server locks for this request
 assert.equal(previewReceived(10000,{rules,available:50000}),7800)
 assert.equal(previewReceived(10000,{rules,available:50000}),withdrawalBreakdown(10000,rules).net)
 assert.equal(previewReceived(12345,{rules:{withdrawFee:0,distributorServiceRate:100},available:50000}),12222)
 assert.equal(previewReceived(10000,{rules:{...rules,distributorServiceRate:0},available:50000}),7900)
 assert.equal(previewReceived(99,{rules,available:50000}),null)
 assert.equal(previewReceived(60000,{rules,available:50000}),null)
 assert.equal(previewReceived(30000,{rules,available:50000,maximum:20000}),null)
 for(const amount of [0,-100,100.5,Number.NaN,'10000',undefined])assert.equal(previewReceived(amount,{rules,available:50000}),null,String(amount))
 // every amount the page accepts is sent as exactly the net it shows
 for(let a=1;a<=3000;a++){const shown=previewReceived(a,{rules:{withdrawFee:37,withdrawTaxRate:1333,distributorServiceRate:250},available:2500,maximum:1800});if(withdrawalAmountProblem(a,{rules:{withdrawFee:37,withdrawTaxRate:1333,distributorServiceRate:250},available:2500,maximum:1800}))assert.equal(shown,null);else assert.equal(shown,a-37-Math.floor(a*1333/10000)-Math.floor(a*250/10000))}
})

test('驳回、转账失败或撤销的提现视为全额退回，只有到账的算实际到账',async()=>{
 const {withdrawalReleased,withdrawalPaid}=await import('../services/withdrawal-amount.js')
 for(const row of [{status:'rejected'},{status:'failed'},{status:'pending',transfer_state:'FAIL'},{status:'pending',transfer_state:'CANCELLED'},{status:'rejected',transfer_state:'REJECTED'}])assert.equal(withdrawalReleased(row),true,JSON.stringify(row))
 for(const row of [{status:'pending'},{status:'pending',transfer_state:'QUEUED'},{status:'pending',transfer_state:'WAIT_USER_CONFIRM'},{status:'paid',transfer_state:'SUCCESS'},{status:'unknown'}])assert.equal(withdrawalReleased(row),false,JSON.stringify(row))
 assert.equal(withdrawalPaid({status:'paid',transfer_state:'SUCCESS'}),true)
 assert.equal(withdrawalPaid({status:'paid'}),true)
 assert.equal(withdrawalPaid({status:'pending',transfer_state:'WAIT_USER_CONFIRM'}),false)
 assert.equal(withdrawalPaid({status:'rejected'}),false)
})

// 单笔提现最多到账 is set by the shop owner in 经营设置 (0.10 元 to 1999.99 元) and reaches the page as distribution.withdrawalMaxAmount.
// Like the server's netAmount check it limits the amount received (申请金额 − 手续费 − 平台服务费 − 代扣税费), not the amount requested.
test('a 500.00 or 1999.99 cap limits the amount received, not the amount requested',()=>{
 const plain={withdrawMinimum:10000,withdrawFee:200} // 最低提现 100 元，每笔手续费 2 元
 // 502.00 - 2.00 = 500.00 fits a 500.00 cap; one more 分 does not
 assert.equal(withdrawalAmountProblem(50200,{rules:plain,available:300000,maximum:50000}),'')
 assert.equal(previewReceived(50200,{rules:plain,available:300000,maximum:50000}),50000)
 assert.equal(withdrawalAmountProblem(50201,{rules:plain,available:300000,maximum:50000}),'单笔到账金额超过限额，请调整金额')
 assert.equal(previewReceived(50201,{rules:plain,available:300000,maximum:50000}),null)
 assert.equal(largestWithdrawal({available:300000,rules:plain,maximum:50000}),50200)
 // more than 200 元 arriving is fine once the server sends a larger cap
 assert.equal(withdrawalAmountProblem(30000,{rules:plain,available:300000,maximum:50000}),'')
 // 2001.99 - 2.00 = 1999.99 fits a 1999.99 cap; 2002.00 arrives as 2000.00 and does not
 assert.equal(withdrawalAmountProblem(200199,{rules:plain,available:300000,maximum:199999}),'')
 assert.equal(previewReceived(200199,{rules:plain,available:300000,maximum:199999}),199999)
 assert.equal(withdrawalAmountProblem(200200,{rules:plain,available:300000,maximum:199999}),'单笔到账金额超过限额，请调整金额')
 assert.equal(largestWithdrawal({available:300000,rules:plain,maximum:199999}),200199)
 // with 20% 代扣税费 and a 1% 平台服务费 the largest request arrives as exactly the cap
 const taxed={withdrawMinimum:10000,withdrawFee:200,withdrawTaxRate:2000,distributorServiceRate:100}
 // 635.43 - 2.00 - 127.08 - 6.35 = 500.00; 635.44 arrives as 500.01
 assert.equal(withdrawalBreakdown(63543,taxed).net,50000);assert.equal(withdrawalBreakdown(63544,taxed).net,50001)
 assert.equal(largestWithdrawal({available:300000,rules:taxed,maximum:50000}),63543)
 assert.equal(withdrawalAmountProblem(63543,{rules:taxed,available:300000,maximum:50000}),'')
 assert.equal(withdrawalAmountProblem(63544,{rules:taxed,available:300000,maximum:50000}),'单笔到账金额超过限额，请调整金额')
 // 2534.16 - 2.00 - 506.83 - 25.34 = 1999.99; 2534.17 arrives as 2000.00
 assert.equal(withdrawalBreakdown(253416,taxed).net,199999);assert.equal(withdrawalBreakdown(253417,taxed).net,200000)
 assert.equal(largestWithdrawal({available:300000,rules:taxed,maximum:199999}),253416)
 assert.equal(previewReceived(253416,{rules:taxed,available:300000,maximum:199999}),199999)
 assert.equal(withdrawalAmountProblem(253417,{rules:taxed,available:300000,maximum:199999}),'单笔到账金额超过限额，请调整金额')
 // the balance still wins when it is below what the cap allows
 assert.equal(largestWithdrawal({available:40000,rules:taxed,maximum:199999}),40000)
})
// For caps far above the brute-force range: each floor drops less than 1 分, so net(a) >= a*kept/10000 - fee and nothing above
// floor((cap+fee)*10000/kept) can fit. Checking every amount between the answer and that bound proves the answer is the largest.
test('largest withdrawal is exact for every cap the owner can set, from 0.10 元 to 1999.99 元',()=>{
 let checked=0
 for(const maximum of [10,20000,50000,123456,199999])for(const rate of [0,1250,2000,5000])for(const serviceRate of [0,100,999])for(const fee of [0,1,200]){
  const rules={withdrawFee:fee,withdrawTaxRate:rate,distributorServiceRate:serviceRate},kept=10000-rate-serviceRate,label=`max ${maximum} tax ${rate} service ${serviceRate} fee ${fee}`
  const best=largestWithdrawal({available:10**9,rules,maximum}),bound=Math.floor((maximum+fee)*10000/kept)
  assert.ok(best>0&&withdrawalBreakdown(best,rules).net<=maximum,label)
  for(let a=best+1;a<=bound+1;a++)assert.ok(withdrawalBreakdown(a,rules).net>maximum,label+' amount '+a)
  checked++
 }
 assert.equal(checked,180)
})
