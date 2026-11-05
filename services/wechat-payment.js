import {request,getToken} from './shop'

// Client success is only a prompt to query the server; it never marks an order paid.
export async function payWithWechat(orderId) {
 const token=getToken()
 const current=()=>{if(token!==getToken())throw Object.assign(Error('登录状态已变更，请刷新订单'),{staleSession:true})}
 const status=await request('/orders/'+orderId+'/wechat-status','POST',{})
 current();if(status.paid)return
 const parameters=await request('/orders/'+orderId+'/wechat-prepay','POST',{})
 current()
 let failure
 try{await new Promise((resolve,reject)=>uni.requestPayment({...parameters,success:resolve,fail:reject}))}catch(e){failure=e}
 current()
 const restricted=!!failure&&/\bbanned\b|no permission|access denied|小程序违规|支付功能.*(?:无法使用|受限)/i.test(String(failure.errMsg||failure.message||''))
 const restrictionError=()=>Object.assign(Error('微信暂时限制此小程序支付，请联系商家处理'),{paymentRestricted:true})
 for(let attempt=0;attempt<4;attempt++){
  let result
  try{result=await request('/orders/'+orderId+'/wechat-status','POST',{})}catch(e){
   current();if(e.staleSession)throw e
   // Preserve a definite platform restriction even when the follow-up query fails.
   // This message does not claim that funds were or were not deducted.
   if(restricted)throw Object.assign(restrictionError(),{uncertain:true})
   throw Object.assign(Error('付款结果待确认，请稍后刷新订单；已扣款请勿重复下单'),{uncertain:true})
  }
  current();if(result.paid)return
  if(failure)break
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1200))
 }
 if(restricted)throw restrictionError()
 if(failure&&/cancel/i.test(failure.errMsg||''))throw Error('已取消微信支付，可在订单中继续付款')
 throw Error('付款结果待确认，请稍后刷新订单；已扣款请勿重复下单')
}
