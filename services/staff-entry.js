import {request,getToken} from './shop.js'
import {shouldOpenWorkbench,isHomeLaunch,ENTRY_PATHS,launchPath} from './staff-workbench.js'

export const WORKBENCH_URL='/pages/staff/index'
const CUSTOMER_VIEW='shop-customer-view'
// The mini-program keeps this module alive for the whole app session; a cold start resets it.
// H5 also keeps the choice in sessionStorage so reloading the same tab does not undo it.
let customerView=false
let launchPending=true

// 记住“这个微信上次是员工”（只记岗位名，退出登录时清掉）：读取员工身份失败（超时、服务暂时不可用）时，只对员工提示重试，不打扰普通顾客（复核 FC-36）
const KNOWN_STAFF='shop-staff-known'
const ownerKey=()=>{try{return String(uni.getStorageSync('shop-owner')||'')}catch{return ''}}
export function rememberStaff(me){try{if(me&&me.bound===true)uni.setStorageSync(KNOWN_STAFF,{owner:ownerKey(),roleLabel:me.roleLabel||''});else uni.removeStorageSync(KNOWN_STAFF)}catch{}}
export function knownStaff(){try{const k=uni.getStorageSync(KNOWN_STAFF);return k&&typeof k==='object'&&String(k.owner||'')===ownerKey()?k:null}catch{return null}}
export async function fetchStaffMe(){const me=await request('/staff/me');rememberStaff(me);return me}

export function customerViewChosen(){
 if(customerView)return true
 // #ifdef H5
 try{return window.sessionStorage.getItem(CUSTOMER_VIEW)==='1'}catch{}
 // #endif
 return false
}
function rememberCustomerView(value){
 customerView=value
 // #ifdef H5
 try{if(value)window.sessionStorage.setItem(CUSTOMER_VIEW,'1');else window.sessionStorage.removeItem(CUSTOMER_VIEW)}catch{}
 // #endif
}

export function switchToCustomerView({complete}={}){
 rememberCustomerView(true)
 uni.reLaunch({url:'/pages/skincare/index',complete})
}

export function openWorkbench({replace=false,complete}={}){
 rememberCustomerView(false)
 if(replace)uni.reLaunch({url:WORKBENCH_URL,complete})
 else uni.navigateTo({url:WORKBENCH_URL,fail:()=>uni.reLaunch({url:WORKBENCH_URL})})
}

function readLaunch(){try{return uni.getLaunchOptionsSync()||null}catch{return null}}
function stillOnEntryPage(){
 try{const pages=getCurrentPages();return pages.length===1&&ENTRY_PATHS.includes(launchPath(pages[0].route))}catch{return false}
}

// Opening any page other than a bottom tab means the person went somewhere on purpose
// (shared product, order link, login…), so the cold-start redirect no longer applies.
export function settleLaunchEntry(){launchPending=false}

// Called once the home/tab page knows who is signed in. Runs at most once per cold start.
export async function checkLaunchEntry(member){
 if(!launchPending)return false
 launchPending=false
 const token=getToken()
 if(!member||!token||customerViewChosen())return false
 const launch=readLaunch()
 if(!isHomeLaunch(launch))return false
 let me
 try{me=await fetchStaffMe()}catch{return false}
 if(token!==getToken()||!stillOnEntryPage()||!shouldOpenWorkbench({launch,customerView:customerViewChosen(),me}))return false
 uni.reLaunch({url:WORKBENCH_URL})
 return true
}
