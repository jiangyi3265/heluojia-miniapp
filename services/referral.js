import {request,getToken} from './shop'

const REFERRER='shop-referrer'
const OWNER='shop-referrer-owner'
const valid=value=>/^[1-9][0-9]{0,14}$/.test(String(value||''))

export function clearReferral(){uni.removeStorageSync(REFERRER);uni.removeStorageSync(OWNER)}

// An expired account's pending click must never be assigned to the next account
// before the login response identifies that account.
export function loginReferrer(){
 const value=uni.getStorageSync(REFERRER),owner=String(uni.getStorageSync(OWNER)||'guest')
 return owner==='guest'&&valid(value)?Number(value):null
}

// Keep the first pending source while a guest signs in. The server owns the
// permanent relationship and will never replace an existing referrer.
export function captureReferral(value){
 if(!valid(value))return
 const owner=getToken()?String(uni.getStorageSync('shop-owner')||uni.getStorageSync('shop-member')?.id||'guest'):'guest'
 const savedOwner=String(uni.getStorageSync(OWNER)||'guest')
 if(savedOwner!=='guest'&&savedOwner!==owner)clearReferral()
 if(!valid(uni.getStorageSync(REFERRER))){uni.setStorageSync(REFERRER,String(value));uni.setStorageSync(OWNER,owner)}
}

let active=null
export async function ensureReferralBeforeOrder(member){
 const token=getToken(),owner=String(uni.getStorageSync('shop-owner')||'')
 if(!token||!member||owner!==String(member.id))throw Object.assign(Error('登录状态已变更，请刷新后重试'),{staleSession:true})
 try{
  const bound=await bindPendingReferral(member)
  if(token!==getToken()||owner!==String(uni.getStorageSync('shop-owner')||''))throw Object.assign(Error('登录状态已变更，请刷新后重试'),{staleSession:true})
  return bound
 }catch(e){
  if(e.staleSession)throw e
  throw Error('推荐来源尚未确认，订单没有提交。请检查网络后重试。')
 }
}
export async function bindPendingReferral(member){
 if(!member||!getToken())return member
 const referrer=String(uni.getStorageSync(REFERRER)||''),owner=String(uni.getStorageSync(OWNER)||'guest')
 if(!valid(referrer))return member
 if((owner!=='guest'&&owner!==String(member.id))||member.referrer_id||String(member.id)===referrer){clearReferral();return member}
 const token=getToken(),key=token+':'+referrer
 if(active?.key!==key){
  const promise=request('/referral','POST',{referrer:Number(referrer)})
  active={key,promise}
 }
 const task=active
 try{
  const result=await task.promise
  if(token!==getToken())throw Object.assign(Error('登录状态已变更，请刷新后重试'),{staleSession:true})
  if(!['bound','kept','ignored'].includes(result?.state))throw Error('推荐来源尚未确认，请刷新后重试')
  if(String(uni.getStorageSync(REFERRER)||'')===referrer)clearReferral()
  return result.referrerId?{...member,referrer_id:result.referrerId}:member
 }finally{if(active===task)active=null}
}
