import {request,getToken} from './shop'

// WeChat replaces the path placeholder with our out_trade_no, not the database ID.
// Resolve only from the current user's server-authorized order list.
export async function resolveWechatOrderLink(orderNo) {
 if(typeof orderNo!=='string'||! /^[a-zA-Z0-9_-]{6,32}$/.test(orderNo))throw Error('订单链接无效，请从订单列表查看')
 const token=getToken()
 if(!token)throw Object.assign(Error('登录后查看该订单'),{loginRequired:true})
 let orders
 try{orders=await request('/orders')}catch(e){
  if(e.staleSession)throw e
  if(/请先登录|登录已过期/.test(e.message||''))throw Object.assign(e,{loginRequired:true})
  throw e
 }
 if(token!==getToken())throw Object.assign(Error('登录状态已变更，请重新查看订单'),{staleSession:true})
 const order=orders.find(o=>o.order_no===orderNo)
 if(!order)throw Error('未找到该订单，或当前微信账号无权查看')
 const id=Number(order.id)
 if(!Number.isSafeInteger(id)||id<=0||!['B','C'].includes(order.channel))throw Error('订单信息异常，请稍后重试')
 return {id:String(id),channel:order.channel}
}
