import {request,getToken} from './shop'

export async function payRecharge(id){
 const token=getToken(),current=()=>{if(token!==getToken())throw Object.assign(Error('登录状态已变化，请重新查看充值记录'),{staleSession:true})}
 const endpoint='/retail-recharge/'+id
 const before=await request(endpoint+'/status','POST',{});current();if(before.paid)return
 const parameters=await request(endpoint+'/prepay','POST',{});current()
 let failure
 try{await new Promise((resolve,reject)=>uni.requestPayment({...parameters,success:resolve,fail:reject}))}catch(e){failure=e}
 current()
 for(let attempt=0;attempt<4;attempt++){
  let status
  try{status=await request(endpoint+'/status','POST',{})}catch(e){current();throw Object.assign(Error('充值结果待确认，请刷新充值记录；已扣款请勿重复充值'),{uncertain:true})}
  current();if(status.paid)return
  if(failure)break
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1200))
 }
 if(failure&&/cancel/i.test(failure.errMsg||''))throw Error('已取消微信支付，可以从充值记录继续付款')
 if(failure&&/banned|no permission|access denied|小程序违规/i.test(failure.errMsg||''))throw Error('微信暂时限制此小程序支付，请联系商家核实')
 throw Object.assign(Error('充值结果待确认，请刷新充值记录；已扣款请勿重复充值'),{uncertain:true})
}

// Keep the exact intent across a lost create response and an app restart.
export async function createRecharge(tier,settings){
 const owner=uni.getStorageSync('shop-owner')||uni.getStorageSync('shop-member')?.id
 if(!owner||!getToken())throw Error('请先登录')
 const key='shop-recharge-intent-'+owner,stored=uni.getStorageSync(key)
 const body=stored||{requestKey:'rc_'+Date.now()+'_'+Math.random().toString(36).slice(2),tierId:tier.id,expectedAmount:tier.amount,settingsVersion:settings.version}
 if(stored&&(body.tierId!==tier.id||body.expectedAmount!==tier.amount))throw Error('上一笔充值结果待确认，请先查询充值记录')
 uni.setStorageSync(key,body)
 try{const result=await request('/retail-recharge','POST',body);uni.removeStorageSync(key);return result}
 catch(e){if(!e.uncertain&&!e.staleSession)uni.removeStorageSync(key);throw e}
}
export function reconcileRechargeIntent(recharges){
 const owner=uni.getStorageSync('shop-owner')||uni.getStorageSync('shop-member')?.id
 if(!owner)return null
 const key='shop-recharge-intent-'+owner,body=uni.getStorageSync(key)
 if(!body)return null
 const row=recharges.find(r=>r.requestKey===body.requestKey)
 if(row){uni.removeStorageSync(key);return null}
 return body
}
