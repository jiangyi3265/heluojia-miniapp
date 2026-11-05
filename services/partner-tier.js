// Plain-language description of a distributor's purchase (拿货) standing.
// Every amount and discount comes from the /partner profile; nothing is hard-coded.
const number=value=>{const n=Number(value);return Number.isFinite(n)?n:null}

export function discountText(rate) {
 const n=number(rate)
 return n&&n>0?Number((n/1000).toFixed(2))+'折':''
}

export function yuanText(fen) {
 const n=Math.max(0,Math.round(number(fen)||0)),whole=Math.floor(n/100),cents=n%100
 return '¥'+String(whole).replace(/\B(?=(\d{3})+(?!\d))/g,',')+(cents?'.'+String(cents).padStart(2,'0'):'')
}

// 零售推广佣金，和商家后台、下单计佣同一个顺序：商家单独设的比例优先；能拿货时按拿货档位自动算“1 − 拿货折扣”，
// 最高 90%；其余按卖出奖励规则。接口里的比例和折扣都按万分算：7800 = 78%，2200 = 2.2折。
export const AUTO_COMMISSION_MAX=9000
export function autoCommissionRate(rate) {
 const n=Math.round(Number(rate))
 if(!Number.isFinite(n)||n<=0||n>=10000)return 0
 return Math.min(AUTO_COMMISSION_MAX,10000-n)
}
export function percentText(rate) {
 const n=number(rate)
 return n===null||rate===null||rate===''?'':Number((n/100).toFixed(2))+'%'
}
const commissionRateOf=view=>view&&view.rate!==null&&view.rate!==undefined&&view.rate!==''&&number(view.rate)!==null?number(view.rate):null

// 专属拿货页的一句话：“你的零售推广佣金：客户实付 × 78%（按拿货档位 2.2折）”
export function retailCommissionSummary(view) {
 if(!view||typeof view!=='object')return ''
 const rate=commissionRateOf(view)
 if(view.source==='partner_tier'&&rate!==null){const discount=discountText(view.discountRate);return '你的零售推广佣金：客户实付 × '+percentText(rate)+'（按拿货档位'+(discount?' '+discount:'')+'）'}
 if(view.source==='member'&&rate!==null)return '你的零售推广佣金：客户实付 × '+percentText(rate)+'（商家单独设置）'
 if(view.source==='rule')return '你的零售推广佣金：按卖出奖励规则'+(rate!==null?'（通用比例 '+percentText(rate)+'）':'')
 if(view.source==='none')return '你的零售推广佣金：暂无（推广资格已停用）'
 return ''
}
// 分销中心一行的右侧：“78%（按拿货档位）”
export function retailCommissionShort(view) {
 if(!view||typeof view!=='object')return ''
 const rate=commissionRateOf(view)
 if(view.source==='partner_tier'&&rate!==null)return percentText(rate)+'（按拿货档位）'
 if(view.source==='member'&&rate!==null)return percentText(rate)+'（商家单独设置）'
 if(view.source==='rule')return rate!==null?percentText(rate)+'（按卖出奖励规则）':'按卖出奖励规则'
 if(view.source==='none')return '暂无（推广资格已停用）'
 return ''
}
// 按拿货档位拿佣金时的补充说明
export function retailCommissionNote(view) {
 if(view?.source!=='partner_tier')return ''
 return '只影响之后的新订单，已下单的按下单时的比例。'+(Number(view.excludedCount)>0?'不参加专属拿货的商品仍按卖出奖励规则计算。':'')
}

// Where the current discount comes from, tolerating profiles without tierSource.
export function partnerTierSource(profile={}) {
 if(['fee','manual','blocked','none'].includes(profile?.tierSource))return profile.tierSource
 if(profile?.mode==='blocked')return 'blocked'
 if(profile?.enabled)return profile.mode==='fixed'?'manual':'fee'
 return 'none'
}

// The three fee thresholds and their discounts, lowest threshold first.
export function partnerTierLadder(profile={}) {
 const thresholds=Array.isArray(profile?.thresholds)?profile.thresholds:[],rates=Array.isArray(profile?.discountRates)?profile.discountRates:[],tiers=Array.isArray(profile?.tiers)?profile.tiers:[]
 const size=Math.max(thresholds.length,rates.length,tiers.length),rows=[]
 for(let i=0;i<size;i++){
  const threshold=number(thresholds[i]??tiers[i]?.referenceAmount),rate=number(rates[i]??tiers[i]?.rate)
  if(!(threshold>0)||!(rate>0))continue
  const commission=autoCommissionRate(rate)
  rows.push({level:i+1,name:String(tiers[i]?.name||''),threshold,rate,thresholdText:yuanText(threshold),rateText:discountText(rate),commissionText:commission?'零售佣金 '+percentText(commission):''})
 }
 return rows
}

function feeLevel(ladder,feeTotal){let level=0;for(const row of ladder)if(feeTotal>=row.threshold)level=row.level;return level}

function nextStep(profile,ladder,feeTotal){
 const next=ladder.find(row=>feeTotal<row.threshold)
 if(!next)return null
 const remaining=number(profile.remainingAmount)>0?number(profile.remainingAmount):next.threshold-feeTotal
 const rate=number(profile.nextRate)>0?number(profile.nextRate):next.rate
 return {threshold:next.threshold,remaining,rate,text:'还差加盟款 '+yuanText(remaining)+'，累计满 '+next.thresholdText+' 可享 '+discountText(rate)}
}

const FEE_NOTE='加盟款由商家登记，是加盟资格费，不进余额，也不能用来付货款。'

export function partnerTierSummary(profile={}) {
 profile=profile||{}
 const ladder=partnerTierLadder(profile),source=partnerTierSource(profile),feeTotal=Math.max(0,number(profile.feeTotal)||0)
 const feeText=feeTotal>0?'已登记加盟款 '+yuanText(feeTotal):''
 const base={kind:'apply',source,title:'',badge:'',lines:[],feeText:'',nextText:'',ladder,currentLevel:0,canBuy:false,showApply:false}
 if(profile.enabled){
  const rate=discountText(profile.rate),level=Number(profile.tier)||0
  if(source==='manual')return {...base,kind:'manual',canBuy:true,title:(profile.name?profile.name+' · ':'')+rate+'拿货',badge:'商家指定',feeText,lines:['当前折扣由商家指定，不随登记的加盟款自动调整；如有疑问请联系客服。']}
  const next=nextStep(profile,ladder,feeTotal)
  return {...base,kind:'fee',canBuy:true,title:(profile.name?profile.name+' · ':'')+rate+'拿货',badge:'按已登记加盟款',currentLevel:level||feeLevel(ladder,feeTotal),feeText:feeText||'已登记加盟款 '+yuanText(0),nextText:next?next.text:ladder.length?'已是最高档拿货折扣':'',lines:[FEE_NOTE]}
 }
 if(profile.distributor){
  if(source==='blocked')return {...base,kind:'blocked',title:'专属拿货已暂停',feeText,lines:['商家已暂停你的专属拿货，暂时不能下拿货单；如有疑问请联系客服。']}
  const next=feeTotal>0?nextStep(profile,ladder,feeTotal):null
  return {...base,kind:'waiting',title:'已通过审核，可以分享商品赚佣金',feeText,nextText:next?next.text:'',lines:['登记加盟款后即可拿货。已缴纳加盟款的，请联系商家登记；登记后按累计金额自动确定拿货折扣。',FEE_NOTE]}
 }
 const state=profile.applicationState
 if(state==='pending')return {...base,kind:'pending',title:'分销申请审核中',lines:['审核通过后可以分享商品赚佣金；商家登记加盟款后即可拿货。'],showApply:true}
 if(state==='rejected')return {...base,kind:'rejected',title:'分销申请未通过',lines:['请查看原因并完善资料后重新提交。审核通过后可以分享商品赚佣金，登记加盟款后即可拿货。'],showApply:true}
 return {...base,kind:'apply',title:'申请成为分销商',lines:['审核通过后可以分享商品赚佣金；商家登记加盟款后即可拿货。'],showApply:true}
}

// One short line for entry rows (我的 page, 商城档案).
export function partnerStatusLine(profile,distributorState) {
 const summary=partnerTierSummary(profile||{applicationState:distributorState,distributor:distributorState==='approved'})
 if(summary.canBuy)return (profile.name?profile.name+' · ':'')+discountText(profile.rate)+'拿货'
 if(summary.kind==='blocked')return '专属拿货已暂停 · 请联系客服'
 if(summary.kind==='waiting')return '已通过审核 · 登记加盟款后即可拿货'
 if(summary.kind==='pending')return '申请审核中 · 查看进度'
 if(summary.kind==='rejected')return '申请未通过 · 修改资料'
 return '先申请分销商 · 审核通过后可推广'
}
