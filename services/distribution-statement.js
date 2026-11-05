// Monthly statement (月度结算单) for the signed-in distributor.
// The server adds everything up; this file only reads its reply, offers months to choose and words the lines.
// Amounts are 分; rates are parts of 10000 (100 = 1%).
import {withdrawalRecordAmounts,taxRateText} from './withdrawal-amount.js'

export const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/
const present=value=>value!==null&&value!==undefined&&value!==''
const amount=value=>{const n=Number(value);return present(value)&&Number.isFinite(n)?Math.round(n):0}
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null
// First value found under any of the names, looking through each source in order.
function pick(sources,names){for(const source of sources){if(!object(source))continue;for(const name of names)if(present(source[name]))return source[name]}return undefined}
function list(sources,names){for(const source of sources){if(!object(source))continue;for(const name of names)if(Array.isArray(source[name]))return source[name]}return []}

const pad=n=>String(n).padStart(2,'0')
// Months follow the shop's China time zone, whatever the phone's own setting is.
export function monthOf(date=new Date()){const d=new Date(date.getTime()+8*60*60*1000);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)}
export function shiftMonth(month,delta){if(!MONTH.test(month||''))return '';const index=Number(month.slice(0,4))*12+Number(month.slice(5))-1+delta;return Math.floor(index/12)+'-'+pad(index%12+1)}
export function monthLabel(month){return MONTH.test(month||'')?Number(month.slice(0,4))+' 年 '+Number(month.slice(5))+' 月':''}

// The last 12 months (newest first) plus any month the server lists as having records.
// The server always lists the current month, even before anything happened in it, so the current month is only marked
// once its own statement has been read and shows records. `checked` maps months already read to whether they had records.
export function monthChoices(active=[],now=new Date(),checked={}){
 const current=monthOf(now)
 const listed=(Array.isArray(active)?active:[]).map(m=>typeof m==='string'?m:m?.month).filter(m=>MONTH.test(m||''))
 const marked=new Set(listed.filter(m=>m!==current))
 for(const [month,has] of Object.entries(object(checked)||{}))if(MONTH.test(month)){if(has)marked.add(month);else marked.delete(month)}
 const months=new Set([...listed,...marked])
 for(let i=0;i<12;i++)months.add(shiftMonth(current,-i))
 return [...months].sort().reverse().map(month=>({month,label:monthLabel(month)+(marked.has(month)?' · 有记录':''),active:marked.has(month)}))
}

// Whether a read statement has anything in it: a commission change or a withdrawal that arrived.
export function statementHasRecords(statement){
 const s=statement?.summary||{}
 return !!(s.commissionGenerated||s.commissionClawedBack||s.withdrawals||statement?.events?.length||statement?.withdrawals?.length)
}

// One withdrawal of the month. The server sends camelCase names (withdrawFee, taxWithheld, serviceFee, netPaid, handledAt);
// they are handed to withdrawalRecordAmounts under the names it reads, so each line shows the deductions locked on that record.
function statementWithdrawal(item,index){
 const row=object(item)||{},get=names=>pick([row],names)
 const amounts=withdrawalRecordAmounts({
  amount:get(['amount']),
  fee:get(['fee','withdrawFee','withdraw_fee']),
  tax_amount:get(['tax_amount','taxWithheld','tax_withheld','taxAmount']),
  tax_rate:get(['tax_rate','taxRate']),
  service_fee:get(['service_fee','serviceFee']),
  service_rate:get(['service_rate','serviceRate']),
  received_amount:get(['received_amount','receivedAmount','netPaid','net_paid'])
 })
 return {...amounts,id:row.id??'withdrawal-'+index,at:get(['handled_at','handledAt','paid_at','paidAt','updated_at','updatedAt','created_at','createdAt'])||'',state:row.status||''}
}

// Reads the reply of GET /shop/app/distribution/statements. The server sends the totals at the top level (there
// `withdrawals` is the count), the commission changes as rewardEvents (date in `time`) and the paid withdrawals as
// withdrawalRecords (camelCase amounts). Also accepts the statement under statement/row/summary, snake_case names,
// and detail lists under detail. A missing total is worked out from the detail lists so the page never shows a blank line.
export function readStatement(data={},requested=''){
 const body=object(data)||{},detail=object(body.detail),sources=[body.statement,body.row,body.summary,body,detail]
 const withdrawalList=list([body,detail,object(body.statement)],['withdrawalRecords','withdrawal_records','withdrawalRows','withdrawal_rows','withdrawalList','withdrawalDetails','withdrawals'])
 const eventList=list([body,detail,object(body.statement)],['events','rewardEvents','reward_events','commissionEvents','ledger'])
 const events=eventList.map((item,index)=>{const row=object(item)||{};return {
  id:row.id??'event-'+index,
  delta:amount(row.delta??row.amount),
  note:String(row.note||row.reason||''),
  orderNo:String(row.order_no||row.orderNo||''),
  at:row.created_at||row.createdAt||row.time||row.occurred_at||row.occurredAt||''
 }}).filter(row=>row.delta!==0)
 const withdrawals=withdrawalList.map(statementWithdrawal)
 const total=(names,fallback)=>{const value=pick(sources,names);return present(value)?amount(value):fallback()}
 // Worked-out totals only count withdrawals that reached the wallet, like the server's statement.
 const paid=withdrawals.filter(w=>!w.state||w.state==='paid'),sum=key=>paid.reduce((s,row)=>s+row[key],0)
 const count=pick(sources,['withdrawalCount','withdrawal_count','withdrawals'])
 const monthEnd=pick(sources,['availableAtMonthEnd','available_at_month_end'])
 const month=pick([body,object(body.statement)],['month'])
 const summary={
  commissionGenerated:total(['commissionGenerated','commission_generated'],()=>events.filter(e=>e.delta>0).reduce((s,e)=>s+e.delta,0)),
  commissionClawedBack:Math.abs(total(['commissionClawedBack','commission_clawed_back'],()=>events.filter(e=>e.delta<0).reduce((s,e)=>s-e.delta,0))),
  withdrawals:typeof count==='number'||(typeof count==='string'&&/^\d+$/.test(count))?amount(count):paid.length,
  withdrawnGross:total(['withdrawnGross','withdrawn_gross'],()=>sum('amount')),
  withdrawFee:total(['withdrawFee','withdraw_fee'],()=>sum('fee')),
  serviceFee:total(['serviceFee','service_fee'],()=>sum('service')),
  taxWithheld:total(['taxWithheld','tax_withheld'],()=>sum('tax')),
  netPaid:total(['netPaid','net_paid'],()=>sum('received')),
  availableAtMonthEnd:present(monthEnd)&&Number.isFinite(Number(monthEnd))?amount(monthEnd):null
 }
 summary.commissionNet=summary.commissionGenerated-summary.commissionClawedBack
 const rate=pick(sources,['distributorServiceRate','serviceRate','service_rate'])
 return {month:MONTH.test(month||'')?month:requested,months:list([body],['months','activeMonths']),summary,events,withdrawals,serviceRate:present(rate)?amount(rate):null}
}

// Rate shown next to 平台服务费: the rate locked on this month's withdrawals when they all agree,
// otherwise the rate the statement reports, otherwise the current rule. null when it cannot be told.
// A withdrawal with neither a service fee nor a rate was made before the fee applied: it counts as a locked 0, so a
// month of such withdrawals (or a mix with newer ones) does not claim today's rate. A fee without its rate is unknown.
export function statementServiceRate(statement={},rules={}){
 const locked=[...new Set((statement.withdrawals||[]).map(w=>w.serviceRate>0?w.serviceRate:w.service>0?undefined:0).filter(rate=>rate!==undefined))]
 if(locked.length===1)return locked[0]>0?locked[0]:null
 if(locked.length>1)return null
 if(present(statement.serviceRate)&&statement.serviceRate>0)return statement.serviceRate
 const current=Number(rules?.distributorServiceRate)
 return Number.isSafeInteger(current)&&current>0?current:null
}

export function serviceFeeExplanation(rate){
 return rate?'按提现申请金额的 '+taxRateText(rate)+' 收取，提现时直接扣除，不足 1 分的部分不收。':'按提现申请金额的一定比例收取，提现时直接扣除；每笔比例以提现记录为准。'
}

// Errors from the server can carry program wording (paths, English); show a plain sentence instead.
export function statementError(error){
 const message=String(error?.message||'')
 if(!message||/[A-Za-z]{3,}|\/|\{|请求地址|不存在/.test(message))return '结算单暂时打不开，请稍后再试。'
 return message
}
