// 分销中心“推广与团队 → 商品佣金”每一条写明佣金从哪来、按哪笔钱算。
// 服务器（GET /shop/app/distribution-detail 的 rewards）每条带 business_type（retail 零售 / partner 加盟拿货 / enterprise 历史企业采购）、
// channel、depth，以及这件商品的实付 item_net_amount（分）。order_amount 是整单实付，只在旧记录缺少商品实付时兜底显示，并写明是整单。
const present=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))
const enterprise=row=>row.business_type==='enterprise'||row.channel==='B'

// 加盟拿货的佣金是直属上级拿到的拿货差价，不是零售提成。
export function rewardSource(r){
 const row=r||{}
 if(row.business_type==='partner')return '加盟拿货差价 · 直属下级拿货'
 return (enterprise(row)?'企业采购':'零售')+' · '+(Number(row.depth)||1)+'级推广'
}

// 这件商品的实付：零售是客户实付，加盟拿货是下级的拿货实付。
export function rewardPaid(r){
 const row=r||{}
 if(present(row.item_net_amount))return {label:row.business_type==='partner'?'本商品拿货实付':enterprise(row)?'本商品采购实付':'本商品客户实付',amount:Number(row.item_net_amount)}
 return {label:'订单实付（整单）',amount:present(row.order_amount)?Number(row.order_amount):0}
}
