import {request,getToken} from './shop'

const tasks=new Map()
const cartKey=(owner,channel)=>'shop-cart-'+owner+'-'+channel
const mergeKey=(owner,channel)=>cartKey(owner,'merge-'+channel)
const sameItems=(a,b)=>JSON.stringify(a.map(i=>[Number(i.id),Number(i.quantity),i.checked!==false]).sort((x,y)=>x[0]-y[0]))===JSON.stringify(b.map(i=>[Number(i.id),Number(i.quantity),i.checked!==false]).sort((x,y)=>x[0]-y[0]))

// Move the guest draft into an account-owned journal, so failed imports cannot leak
// into the next account. The journal survives retries until the server confirms it.
export function claimGuestCart(owner) {
 for(const channel of ['C','B']) {
  const key=cartKey('guest',channel),items=uni.getStorageSync(key)
  if(Array.isArray(items)&&items.length) {
   const pending=uni.getStorageSync(mergeKey(owner,channel))
   uni.setStorageSync(mergeKey(owner,channel),pending?.attempt?{...pending,queued:[...(pending.queued||[]),...items]}:{items:[...(pending?.items||[]),...items]})
  }
  uni.removeStorageSync(key)
 }
 const key=cartKey('guest','checkout'),draft=uni.getStorageSync(key)
 if(draft) {
  uni.setStorageSync(cartKey(owner,'checkout'),{...draft,...(draft.checkoutSource==='cart'?{cartRevision:null,guestCartMerge:true}:{})})
  uni.removeStorageSync(key)
 }
}

export function mergedCartItems(remote,guest,products,channel='C') {
 const items=remote.map(i=>({...i,id:Number(i.id),quantity:Number(i.quantity)}))
 for(const item of guest) {
  const id=Number(item.id),quantity=Number(item.quantity)
  if(!Number.isSafeInteger(id)||id<=0||!Number.isInteger(quantity)||quantity<1)throw Error('游客购物车数量有误，商品已保留，请重新确认')
  const old=items.find(i=>i.id===id)
  if(old){old.quantity+=quantity;old.checked=old.checked!==false||item.checked!==false}
  else items.push({...item,id,quantity,checked:item.checked!==false})
 }
 if(items.length>100)throw Error('购物车最多保留100种商品，请先移除部分商品再刷新；游客商品已保留')
 if(items.some(i=>i.quantity>10000))throw Error('合并数量超过10000件，请先减少原购物车数量再刷新；游客商品已保留')
 for(const item of items) {
  const product=products.find(p=>Number(p.id)===item.id)
  // Keep excess quantities visible for correction instead of silently ordering fewer.
  if(!product||item.quantity>Number(product.stock)||(channel==='B'&&(item.quantity%Number(product.pack)!==0||item.quantity<Number(product.minimum||product.pack))))item.checked=false
 }
 return items
}

function finishCheckout(owner,channel,remote) {
 const key=cartKey(owner,'checkout'),state=uni.getStorageSync(key)
 if(!state?.guestCartMerge||(state.channel==='B'?'B':'C')!==channel)return
 const review=(state.items||[]).some(i=>{
  const actual=remote.items.find(p=>Number(p.id)===Number(i.id))
  return !actual||actual.checked===false||Number(actual.quantity)<Number(i.quantity)
 })
 const next={...state,cartRevision:remote.revision,cartMergeNeedsReview:review}
 delete next.guestCartMerge
 uni.setStorageSync(key,next)
}

export function guestCartPending(channel) {
 const pending=uni.getStorageSync(mergeKey(uni.getStorageSync('shop-owner'),channel))
 return [...(pending?.items||[]),...(pending?.queued||[])]
}

// These actions are only offered after showing the pending quantities to the user.
export async function resolveGuestCart(channel,action) {
 const owner=uni.getStorageSync('shop-owner'),token=getToken(),key=mergeKey(owner,channel),pending=uni.getStorageSync(key)
 if(!pending)return
 if(action==='retry') {
  uni.setStorageSync(key,{items:[...pending.items,...(pending.queued||[])]})
  return
 }
 if(action==='discard') {
  uni.removeStorageSync(key)
  const draftKey=cartKey(owner,'checkout'),draft=uni.getStorageSync(draftKey)
  if(draft?.guestCartMerge&&(draft.channel==='B'?'B':'C')===channel){const next={...draft,cartMergeNeedsReview:true};delete next.guestCartMerge;uni.setStorageSync(draftKey,next)}
  return
 }
 const remote=await request('/cart/'+channel)
 if(token!==getToken()||String(owner)!==String(uni.getStorageSync('shop-owner')))throw Error('登录状态已变更，请刷新后重试')
 if(pending.queued?.length)uni.setStorageSync(key,{items:pending.queued})
 else{uni.removeStorageSync(key);finishCheckout(owner,channel,remote)}
}

export async function syncAccountCart(channel,products) {
 const owner=uni.getStorageSync('shop-owner'),token=getToken(),key=mergeKey(owner,channel)
 if(!owner||!token)throw Error('请先登录后继续')
 const running=tasks.get(key)
 if(running&&running.token===token)return running.promise
 const current=()=>{if(token!==getToken()||String(owner)!==String(uni.getStorageSync('shop-owner')))throw Error('登录状态已变更，请刷新后重试')}
 const promise=(async function loadAndMerge(){
  let remote=await request('/cart/'+channel);current()
  let pending=uni.getStorageSync(key)
  if(!pending?.items?.length){finishCheckout(owner,channel,remote);return remote}
  if(pending.attempt) {
   if(remote.revision>pending.attempt.revision&&sameItems(remote.items,pending.attempt.items)) {
    if(pending.queued?.length){uni.setStorageSync(key,{items:pending.queued});return loadAndMerge()}
    uni.removeStorageSync(key);finishCheckout(owner,channel,remote);return remote
   }
   if(remote.revision!==pending.attempt.revision)return {...remote,mergeError:'上次合并结果尚未确认，购物车又有更新；游客商品已保留，请核对后选择下方恢复方式'}
  }
  for(let attempt=0;attempt<3;attempt++) {
   pending=uni.getStorageSync(key)
   if(!pending)return remote
   let items
   try{items=mergedCartItems(remote.items,pending.items,products,channel)}catch(e){return {...remote,mergeError:e.message}}
   current();pending={...pending,attempt:{revision:remote.revision,items}};uni.setStorageSync(key,pending)
   try {
    const saved=await request('/cart/'+channel,'PUT',{revision:remote.revision,items});current()
    const queued=uni.getStorageSync(key)?.queued
    if(queued?.length){uni.setStorageSync(key,{items:queued});return loadAndMerge()}
    uni.removeStorageSync(key);finishCheckout(owner,channel,saved);return saved
   } catch(e) {
    current()
    if(!/购物车已在其他页面更新/.test(e.message))return {...remote,mergeError:e.message+'；游客商品已保留，请核对购物车后重试'}
    // A revision rejection guarantees this write was not applied; safe to rebase.
    pending=uni.getStorageSync(key)
    if(!pending)return remote
    delete pending.attempt;uni.setStorageSync(key,pending)
    remote=await request('/cart/'+channel);current()
   }
  }
  return {...remote,mergeError:'购物车正在其他页面更新，请稍后刷新；游客商品已保留'}
 })()
 tasks.set(key,{token,promise})
 try{return await promise}finally{if(tasks.get(key)?.promise===promise)tasks.delete(key)}
}
