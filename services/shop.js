import {purchaseEntry} from './purchase-entry.js'
import {uploadImage} from './image-upload.js'
import {createNavigationGuard} from './navigation-guard.js'
import {noteServerDate} from './server-clock.js'
// Configure .env.local for this deployment; a fresh checkout never calls production by default.
export const API_BASE = import.meta.env.VITE_SHOP_API_BASE || 'http://127.0.0.1:18080'
export const money = value => (Number(value || 0) / 100).toFixed(2)
export const asset = (path,width=640) => path && (path.startsWith('http') || path.startsWith('/static/')) ? path : API_BASE + (path || '') + (path?.startsWith('/shop-assets/')?'?width='+width:'')
export const getToken = () => uni.getStorageSync('shop-token') || ''
export function request(path, method = 'GET', data) {
 const token=getToken(),sentAt=Date.now()
 const stale=()=>Object.assign(new Error('登录状态已变更，请刷新后重试'),{staleSession:true})
 return new Promise((resolve, reject) => uni.request({ url: API_BASE + '/shop/app' + path, method, data, timeout:15000,
  header: { 'Content-Type':'application/json', 'X-Shop-Token':'Bearer ' + token },
  success: res => { try{noteServerDate(res.header,sentAt)}catch(e){/* 记录时间失败不影响接口结果 */}if(token!==getToken()){reject(stale());return}const b = res.data; if (b && b.code === 200) resolve(b.data); else { const message=b?.msg||'服务暂时不可用'; if (/请先登录|登录已过期|账号已停用/.test(message)&&token===getToken()) invalidateLocalSession(); reject(Object.assign(new Error(message),{uncertain:res.statusCode>=500||!b||typeof b.code!=='number'})) } },
  fail: () => reject(token!==getToken()?stale():Object.assign(new Error('无法连接服务，请检查网络后重试'),{uncertain:true}))
 }))
}
const allowNavigation=createNavigationGuard()
export function go(screen, query = {}) { ({screen,query}=purchaseEntry(screen,query)); const tail=Object.keys(query).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(query[k])).join('&'); const url='/pages/'+screen+'/index'+(tail?'?'+tail:'');if(!allowNavigation(url))return;uni.navigateTo({url,fail:()=>uni.redirectTo({url})}) }
export function home(screen='index') { uni.reLaunch({url:'/pages/'+screen+'/index'}) }
export function notify(e) { if(e?.staleSession||e?.superseded)return;uni.showToast({title:e.message||String(e),icon:'none',duration:2500}) }
export const labels={unknown:'结果待核实',failed:'处理失败，金额已释放',pending:'待付款',paid:'待发货',shipping:'部分发货',shipped:'待收货',completed:'已完成',cancelled:'已取消',refunded:'已退款',none:'未申请',approved:'已通过',rejected:'已驳回',available:'可提现',reversed:'已扣回'}
export async function uploadLicense(path) {
 const result=await uploadImage({path,url:API_BASE+'/shop/app/license',token:getToken()})
 if(!/^\/shop\/admin\/license\/[a-f0-9-]{36}\.png$/.test(result||''))throw Error('未取得图片凭证，请重新上传')
 return result
}
export function uploadPublicImage(path){return uploadImage({path,url:API_BASE+'/shop/app/public-image',token:getToken()})}
export function uploadTransferProof(path){return uploadImage({path,url:API_BASE+'/shop/app/transfer-proof',token:getToken()})}
export function uploadSupportImage(path){return uploadImage({path,url:API_BASE+'/shop/app/support/images',token:getToken()})}

export function promotionQuery(query={}) {
 if(!query.scene)return query;
 try{const match=decodeURIComponent(query.scene).match(/^r([0-9a-z]+)\.([0-9a-z]+)\.([BC])$/);if(!match)return query;const referrer=parseInt(match[1],36),id=parseInt(match[2],36);if(!Number.isSafeInteger(referrer)||referrer<=0||!Number.isSafeInteger(id)||id<0)return query;return {...query,referrer:String(referrer),...(id?{id:String(id)}:{}),channel:match[3]}}catch{return query}
}

// Remove the session and editable drafts even when offline. Account-owned pending
// order journals survive logout so a lost response cannot lead to duplicate orders.
export function clearLocalSession() {
 const owner=uni.getStorageSync('shop-owner')||uni.getStorageSync('shop-member')?.id
 const fixed=['shop-owner','shop-token','shop-member','shop-selected-address','shop-cart-C','shop-cart-B','shop-return','shop-referrer','shop-referrer-owner','shop-staff-known']
 const keys=uni.getStorageInfoSync().keys||[]
 for(const key of keys)if(fixed.includes(key)||(owner&&(key.startsWith('shop-cart-'+owner+'-')||key.startsWith('shop-draft-'+owner+'-')||key==='shop-partner-list-'+owner)))uni.removeStorageSync(key)
 for(const key of fixed)uni.removeStorageSync(key)
}

// Detach expired credentials without destroying this account's order idempotency or drafts.
// Private account keys can only be reached again after authenticating that account.
export function invalidateLocalSession() {
 for(const key of ['shop-token','shop-member','shop-owner','shop-selected-address'])uni.removeStorageSync(key)
}
