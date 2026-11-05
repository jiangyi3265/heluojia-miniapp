// Shared loader for the staff module tests (not a test file itself: it does not match *.test.mjs).
// Helpers under pages/staff/services have no imports, so they load straight from a data: URL.
// Components run their real data/computed/methods with the imported names supplied as deps.
// The component state is made reactive with Vue's own reactivity, as on the phone, so code that keeps a
// plain object and compares or changes it instead of the screen's copy fails here as it would there.
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const {reactive}=createRequire(import.meta.url)('@vue/reactivity')
export const loadHelpers=rel=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL(rel,import.meta.url),'utf8')).toString('base64'))
export function loadComponent(rel,deps,props={}){
 const script=readFileSync(new URL(rel,import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .+$/gm,'').replace('export default','return')
 const component=Function(...Object.keys(deps),script)(...Object.values(deps)),emitted=[]
 const raw={...component.data.call(props),...props,$emit:(n,v)=>emitted.push([n,v]),$nextTick:f=>f(),$refs:{}}
 for(const [k,get] of Object.entries(component.computed||{}))Object.defineProperty(raw,k,{get(){return get.call(this)},configurable:true,enumerable:false})
 const vm=reactive(raw)
 for(const [k,m] of Object.entries(component.methods||{}))raw[k]=m.bind(vm)
 return {vm,emitted,component}
}
// A stand-in for the uni global: modals answer `confirm`, toasts are collected.
export function fakeUni(toasts=[],confirm=true,extra={}){
 return {showModal:o=>o.success({confirm:typeof confirm==='function'?confirm(o):confirm}),showToast:o=>toasts.push(o.title),pageScrollTo(){},chooseImage(){},getStorageSync:()=>'',setStorageSync(){},makePhoneCall(){},...extra}
}
// Lets queued promise callbacks run.
export const settle=()=>new Promise(resolve=>setImmediate(resolve))
