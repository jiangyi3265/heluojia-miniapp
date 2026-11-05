// Withdrawal amounts shown before submitting. Only an estimate: the server locks fee, platform service fee, tax and transfer amount on the record.
// Amounts are 分; rates are parts of 10000 (2000 = 20%, 100 = 1%). Tax and the platform service fee are each taken from the requested (pre-tax) amount, rounded down to 分.
export const MIN_NET_AMOUNT=10
const whole=value=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:0}
const present=value=>value!==null&&value!==undefined&&value!==''

export function withdrawalTax(amount,rate){return Math.floor(whole(amount)*whole(rate)/10000)}

// Distributor platform service fee (分销商平台服务费), same rounding as the server: floor(amount × rate / 10000).
export function withdrawalServiceFee(amount,rate){return withdrawalTax(amount,rate)}

// Rate of the platform service fee: the bootstrap rules are preferred, the distribution summary is the fallback.
// A rate saved as 0 in the rules stays 0; a missing rate means no service fee is shown.
export function distributorServiceRate(rules={},distribution={}){
 return whole(present(rules?.distributorServiceRate)?rules.distributorServiceRate:distribution?.distributorServiceRate)
}

// 2000 -> "20%", 1250 -> "12.5%", 5 -> "0.05%"
export function taxRateText(rate){return Number((whole(rate)/100).toFixed(2))+'%'}
export const rateText=taxRateText

export function withdrawalBreakdown(amount,rules={}){
 const value=whole(amount),fee=whole(rules.withdrawFee),rate=whole(rules.withdrawTaxRate),tax=withdrawalTax(value,rate)
 const serviceRate=whole(rules.distributorServiceRate),service=withdrawalServiceFee(value,serviceRate)
 return {amount:value,fee,rate,tax,serviceRate,service,net:value-fee-service-tax}
}

// "手续费" / "手续费和代扣税费" / "手续费、平台服务费和代扣税费": only what this amount actually pays.
export function deductionText(b={}){
 const names=[];if(whole(b.fee)>0)names.push('手续费');if(whole(b.service)>0)names.push('平台服务费');if(whole(b.tax)>0)names.push('代扣税费')
 return names.length>1?names.slice(0,-1).join('、')+'和'+names[names.length-1]:(names[0]||'')
}

// Plain explanation under the amount lines; empty when neither a service fee nor tax applies.
export function withdrawalFeeNote(rules={}){
 const service=whole(rules.distributorServiceRate),tax=whole(rules.withdrawTaxRate)
 if(!service&&!tax)return ''
 let note=''
 if(service)note+='平台服务费按提现申请金额的 '+taxRateText(service)+' 收取，不足 1 分的部分不收。'
 if(tax)note+='代扣税费按提现申请金额（税前）的 '+taxRateText(tax)+' 计算，不足 1 分的部分不扣，由公司代为申报缴纳。'
 return note+'预计到账 = 申请金额 − '+[whole(rules.withdrawFee)&&'手续费',service&&'平台服务费',tax&&'代扣税费'].filter(Boolean).join(' − ')+'。'
}

// Empty string means the amount can be submitted (the server still has the final say).
export function withdrawalAmountProblem(amount,{rules={},available=0,maximum=0}={}){
 const b=withdrawalBreakdown(amount,rules),deductions=deductionText(b)
 if(b.amount<whole(rules.withdrawMinimum))return '金额未达到最低提现要求'
 if(b.net<=0)return deductions?'提现金额需要高于'+deductions:'请输入大于 0 的提现金额'
 if(b.amount>Math.max(0,Number(available)||0))return '金额超过当前可提现佣金'
 if(b.net<MIN_NET_AMOUNT)return (deductions?'扣除'+deductions+'后，':'')+'到账金额至少 ¥0.10'
 if(whole(maximum)>0&&b.net>whole(maximum))return '单笔到账金额超过限额，请调整金额'
 return ''
}

// The 预计到账 (整数分) the page shows for this amount and sends to the server as expectedReceived.
// null while the amount has any problem above: the page then shows "—" and sends nothing.
export function previewReceived(amount,{rules={},available=0,maximum=0}={}){
 if(!Number.isSafeInteger(amount)||amount<=0||withdrawalAmountProblem(amount,{rules,available,maximum}))return null
 return withdrawalBreakdown(amount,rules).net
}

// Largest amount not above the available balance whose net (amount - fee - service fee - tax) stays within the per-transfer maximum.
// With k = (10000 - taxRate - serviceRate) / 10000 each floor drops less than 1 分, so a*k - fee <= net(a) < a*k - fee + 2:
// nothing above floor((max+fee)*10000/(10000-taxRate-serviceRate)) can fit, and stepping down from there reaches a fitting amount within about 2/k steps.
// Both floors can step up on the same 分, so net is not always increasing; checking each amount keeps the answer exact.
export function largestWithdrawal({available=0,rules={},maximum=0}={}){
 const cap=Math.max(0,Math.floor(Number(available)||0)),max=whole(maximum),kept=10000-whole(rules.withdrawTaxRate)-whole(rules.distributorServiceRate)
 // kept <= 0: net never exceeds 1 分 minus the fee, so every amount fits the maximum.
 if(!max||kept<=0)return cap
 for(let a=Math.min(cap,Math.floor((max+whole(rules.withdrawFee))*10000/kept));a>0;a--)if(withdrawalBreakdown(a,rules).net<=max)return a
 return 0
}

// Amounts for a saved withdrawal record. received_amount from the server already equals amount - fee - tax - service fee.
export function withdrawalRecordAmounts(row={}){
 const amount=whole(row.amount),fee=whole(row.fee),tax=whole(row.tax_amount),rate=whole(row.tax_rate),service=whole(row.service_fee),serviceRate=whole(row.service_rate)
 const received=present(row.received_amount)&&Number.isFinite(Number(row.received_amount))?Number(row.received_amount):amount-fee-tax-service
 return {amount,fee,tax,rate,service,serviceRate,received}
}
// 驳回、转账失败或撤销的提现没有扣任何费用，申请金额全额退回可提现佣金；只有到账的才是“实际到账”
export function withdrawalReleased(row={}){return ['rejected','failed'].includes(row.status)||['FAIL','CANCELLED','REJECTED'].includes(row.transfer_state)}
export function withdrawalPaid(row={}){return row.transfer_state==='SUCCESS'||(row.status==='paid'&&!row.transfer_state)}
