// Customer-facing order wording that depends on the delivery method or on how the order was paid.
// Amounts are in fen (100 fen = 1 yuan).
const yuan=value=>'¥'+(Number(value||0)/100).toFixed(2)

// Store pickup orders are never shipped: say where the goods are instead of "待发货".
export function pickupState(order){
 if(order?.delivery_method!=='pickup')return ''
 if(order.status==='paid')return order.pickup_status==='ready'?'待自提':'待备货'
 if(order.status==='completed'&&order.pickup_status==='collected')return '已取货'
 return ''
}
const PICKUP_HINTS={'待备货':'门店正在为您备货，备好后请到店出示取货码取货','待自提':'商品已备好，请到店出示取货码取货','已取货':'已在门店取货，感谢您的购买'}
export function pickupHint(order){return PICKUP_HINTS[pickupState(order)]||''}

// Balance + WeChat: the balance part came from the account, only the rest went through WeChat.
export function paymentParts(order){
 const wallet=Number(order?.wallet_amount||0),wechat=Number(order?.external_amount||0)
 return order?.payment_mode==='wechat'&&wallet>0?{wallet,wechat}:null
}
const PAYMENT_MODES={wechat:'微信支付',rebate:'企业返利抵扣',wallet:'余额支付',credit:'账期采购',bank_transfer:'对公转账',simulation:'非实收记账',exchange:'积分兑换',points_exchange:'积分兑换'}
export function paymentModeText(order){return paymentParts(order)?'余额 + 微信支付':PAYMENT_MODES[order?.payment_mode]||'付款方式待确认'}
export function paymentPartsText(order){const p=paymentParts(order);return p?'余额支付 '+yuan(p.wallet)+' · 微信支付 '+yuan(p.wechat):''}
export function exchangeOrder(order){return ['points_exchange','exchange'].includes(order?.payment_mode)}

// Refunds go back the way the order was paid; say how much reached WeChat and how much the balance.
export function refundPartsText(order){
 const wallet=Number(order?.refunded_wallet||0)
 return paymentParts(order)&&wallet>0?'其中退回微信 '+yuan(Math.max(0,Number(order.refunded_external||0)))+'，退回余额 '+yuan(wallet):''
}
export function caseRefundParts(c){
 if(c?.payment_mode!=='wechat'||c.wechat_refund_amount==null||Number(c.order_wallet_amount||0)<=0||!['awaiting_refund','refunded'].includes(c.status))return null
 const wechat=Math.max(0,Number(c.wechat_refund_amount||0)),wallet=Number(c.amount||0)-wechat
 return wallet>0?{wechat,wallet}:null
}
export function caseRefundText(c){const p=caseRefundParts(c);return p?(c.status==='refunded'?'':'将')+'退回微信 '+yuan(p.wechat)+'，退回余额 '+yuan(p.wallet):''}
export function refundedCaseTitle(c){const p=caseRefundParts(c);return !p?'微信原路退款成功':p.wechat>0?'退款成功，已按原付款方式退回':'退款成功，已退回余额'}

// WeChat closed (CLOSED) or could not deliver (ABNORMAL) the refund: no money has moved, so never promise an automatic arrival.
const REFUND_ATTENTION={CLOSED:{title:'微信退款未成功，待商家重新发起',hint:'微信退款未成功，商家将重新发起退款；如超过1个工作日仍未到账，请联系客服。'},ABNORMAL:{title:'退款暂未到账，商家处理中',hint:'微信退款暂未到账，商家正在处理；如有疑问请联系客服。'}}
const stalledRefund=c=>c?.status==='awaiting_refund'?REFUND_ATTENTION[c.wechat_refund_state]:null
export function stalledRefundTitle(c){return stalledRefund(c)?.title||''}
export function stalledRefundHint(cases,orderId){const c=(cases||[]).find(c=>String(c.order_id)===String(orderId)&&stalledRefund(c));return c?stalledRefund(c).hint:''}

// "优惠金额" covers coupons and promotions only; points have their own line so nothing shows twice.
export function offerDiscount(source){return Math.max(0,Number(source?.discount||0)-Number(source?.pointsDiscount??source?.points_discount??0))}

// Switching a promoter off keeps what was already earned: show the money and records, hide sharing.
export function distributionStopped(member,distribution){
 if(member?.distributor_state!=='rejected')return false
 const d=distribution||{}
 return Number(d.available||0)!==0||['commission','withdrawals','lineRewards','ledger'].some(key=>Array.isArray(d[key])&&d[key].length>0)
}
