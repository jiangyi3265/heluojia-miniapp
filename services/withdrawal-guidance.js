const integer=value=>value!==null&&value!==undefined&&value!==''&&Number.isSafeInteger(Number(value))?Number(value):null
const cents=value=>Math.max(0,integer(value)??0)
const yuan=value=>(value/100).toFixed(2)

// Public withdrawal rules use the same live amounts and review deadline as the
// application form. There is no business limit on the number of daily requests
// and no time-of-day gate; the server still checks balance and transfer limits.
export function withdrawalRuleRows(distribution={},rules={}){
 const minimum=integer(rules.withdrawMinimum),maximum=integer(distribution.withdrawalMaxAmount),days=integer(rules.withdrawWorkingDays)
 // 每人每日到账限额（分）由服务器下发；还没下发的旧后端只说明有这个限额，不编金额；0 表示服务器关闭了本地每日限额。
 const daily=integer(distribution.withdrawalDailyLimit)
 const fee=integer(rules.withdrawFee),tax=integer(rules.withdrawTaxRate),service=integer(rules.distributorServiceRate??distribution.distributorServiceRate)
 const rate=value=>Number((value/100).toFixed(2))+'%'
 const threshold=minimum!==null&&minimum>=0?(minimum>0?'每笔申请至少 ¥'+yuan(minimum)+'。':'不设商家最低申请金额。'):'最低申请金额请以加载后的页面为准。'
 const cap=maximum!==null&&maximum>0?'单笔扣费后到账 ¥0.10 至 ¥'+yuan(maximum)+'。':'扣费后到账至少 ¥0.10；单笔上限暂未加载，请刷新查看。'
 const limit=daily===null?'商家设置的每人每日到账限额':daily>0?'商家设置的每人每日到账限额（¥'+yuan(daily)+'）':''
 const count=limit
  ?'每日申请次数不设固定上限。每笔均须满足可提现余额及单笔到账限额；同一推广员每天累计到账不超过'+limit+'，还受微信额度限制。超过每日到账限额的申请，要等额度允许后才能审核；已审核的转账也可能顺延到额度允许时自动发出。长时间未处理请联系商家。'
  :'每日申请次数不设固定上限。每笔均须满足可提现余额及单笔到账限额；每天累计到账受微信额度限制。'
 const fees=[fee,tax,service].every(value=>value!==null&&value>=0)
  ?'每笔手续费 ¥'+yuan(fee)+'；代扣税费 '+rate(tax)+'；平台服务费 '+rate(service)+'。比例费用按申请金额计算，不足 1 分的部分不扣；以提交前的预计到账金额为准。'
  :'费用规则暂未加载完整，请刷新后核对手续费、代扣税费、平台服务费及预计到账金额。'
 return [
  {key:'amount',label:'可提现额度',text:'申请金额不能超过上方的可提现佣金。'+threshold+cap+'待结算、冻结及提现处理中的金额不能重复申请。'},
  {key:'count',label:'每日提现次数',text:count},
  {key:'hours',label:'提现时间',text:'每天 00:00–24:00 均可提交申请，周末也可申请。'},
  {key:'review',label:'审核时间',text:days!==null&&days>=1&&days<=30?'提交后预计 '+days+' 个工作日内完成财务审核，工作日按周一至周五计算，遇法定节假日顺延。审核进度可在“提现记录”查看。':'审核时限暂未加载，请刷新页面查看；进度可在“提现记录”查询。'},
  {key:'arrival',label:'到账时间',text:'审核通过并发起微信转账后，请到“提现记录”点击“确认收款”。确认后微信立即处理转账，成功后到账本人微信零钱，实际到账时间以微信处理结果为准。'},
  {key:'confirmation',label:'收款期限',text:'微信发起转账后，请在 24 小时内确认收款；逾期微信会关闭转账，系统核实关闭后退回可提现佣金，关闭及退回可能有延迟。'},
  {key:'fees',label:'提现费用',text:fees},
  {key:'failure',label:'未到账处理',text:'申请被拒、转账失败或关闭后，系统核实状态并退回申请金额，不扣提现费用。处理中请勿重复申请；有疑问请联系小程序客服。'}
 ]
}

// The server's "available" already subtracts withdrawals still in progress; those are not money owed.
// A refund clawback debt is only what stays negative after adding them back.
const inProgress=distribution=>(distribution?.withdrawals||[]).filter(row=>['pending','unknown'].includes(row.status)).reduce((sum,row)=>sum+cents(row.amount),0)
export function commissionDebt(distribution={}){
 const available=integer(distribution?.available)
 return available!==null&&available<0?Math.max(0,-(available+inProgress(distribution))):0
}

// Explain the recorded state only. Eligibility and money movement remain server decisions.
export function withdrawalGuidance(distribution={},rules={}){
 const available=integer(distribution.available),minimum=integer(rules.withdrawMinimum)
 const groups={receipt:0,settlement:0,afterSale:0,other:0},days=new Set()
 let unknownDays=false
 for(const row of distribution.lineRewards||[]){
  const pending=Math.max(0,cents(row.amount)-cents(row.available_amount))
  if(!pending)continue
  const reason=String(row.reason||'')
  const key=reason.includes('售后')?'afterSale':reason==='等待实际收货'?'receipt':reason==='等待收货后结算期'?'settlement':'other'
  groups[key]+=pending
  const wait=integer(row.wait_days)
  if(wait!==null&&wait>=0)days.add(wait);else unknownDays=true
 }
 for(const row of distribution.commission||[]){
  if(row.status!=='pending'||!cents(row.amount))continue
  groups.other+=cents(row.amount);unknownDays=true
 }
 const labels={receipt:'等待客户收货',settlement:'收货后结算中',afterSale:'售后处理中',other:'其他待结算佣金'}
 const breakdown=Object.entries(groups).filter(([,amount])=>amount>0).map(([key,amount])=>({key,label:labels[key],amount}))
 const pending=Object.values(groups).reduce((sum,amount)=>sum+amount,0)
 const reserved=inProgress(distribution),debt=commissionDebt(distribution),shortfall=available!==null&&available<0
 const belowMinimum=available!==null&&minimum!==null&&available<minimum
 let title='佣金结算与提现说明'
 if(debt>0)title='退款佣金待抵扣'
 else if(shortfall&&reserved>0)title='已有提现申请处理中'
 else if(pending>0&&(available===0||belowMinimum))title='为什么暂时不能提现？'
 else if(reserved>0&&available===0)title='已有提现申请处理中'
 else if(belowMinimum)title='尚未达到提现门槛'
 else if(available===0)title='暂时没有可提现佣金'
 let settlement='订单实际收货并完成结算期后，佣金才可提现；具体时间请查看佣金明细。'
 const periods=[...days].sort((a,b)=>a-b)
 if(periods.length&&!unknownDays){
  settlement=periods.length===1
   ?periods[0]===0?'这些订单在实际收货、售后核对完成后结算。':`这些订单收货后还需结算 ${periods[0]} 天，从实际收货时间开始计算。`
   :`这些订单的结算期为 ${periods.join('、')} 天，按各订单实际收货时间计算。`
 }
 let threshold=minimum!==null&&minimum>0?`可提现余额满 ¥${yuan(minimum)} 才能申请。`:'不设商家提现门槛，按可提现余额申请，扣费后到账至少 ¥0.10；待结算金额暂不计入。'
 if(belowMinimum&&available>=0)threshold+=`当前还差 ¥${yuan(minimum-available)}。`
 return {title,breakdown,pending,settlement,threshold,
  debt:debt>0?`退款佣金 ¥${yuan(debt)} 待抵扣，后续结算佣金会先抵扣。`:'',
  reserved:reserved>0?`已有 ¥${yuan(reserved)} 正在提现处理中，请在提现记录查看进度。`+(shortfall?'因有退款扣回，这笔提现暂时不能审核到账：后续佣金补足后可继续处理，或由商家驳回后金额退回可提现佣金。':''):''}
}
