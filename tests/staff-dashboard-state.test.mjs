import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni} from './staff-component-harness.mjs'
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const dashboard=await loadHelpers('../pages/staff/services/staff-dashboard.js')
const {formatDate}=await loadHelpers('../services/display.js')

function mount(request,me={bound:true,canViewDashboard:true}){
 const deps={request,getToken:()=>'staff-token',formatDate,...management,...dashboard}
 return loadComponent('../pages/staff/components/StaffDashboard.vue',deps,{module:'dashboard',me})
}
function withUni(fn){return async()=>{const toasts=[];globalThis.uni=fakeUni(toasts);try{await fn(toasts)}finally{delete globalThis.uni}}}

test('first failure shows the reason instead of zero figures',withUni(async()=>{
 const {vm}=mount(async()=>{throw Error('暂时连接失败')})
 await vm.load()
 assert.equal(vm.loaded,false);assert.equal(vm.data,null);assert.equal(vm.error,'暂时连接失败');assert.equal(vm.loading,false)
 assert.deepEqual(vm.figures,[])
}))

test('newest range wins over a late answer',withUni(async()=>{
 const pending=[];const urls=[]
 const {vm}=mount(url=>{urls.push(url);return new Promise(resolve=>pending.push(resolve))})
 const today=vm.choose('today')
 vm.choose('month')
 assert.match(urls[0],/range=today$/);assert.match(urls[1],/range=month$/)
 pending[1]({range:{from:'2026-09-01',to:'2026-09-26'}})
 await new Promise(r=>setImmediate(r))
 pending[0]({range:{from:'2026-09-26',to:'2026-09-26'}})
 await today;await new Promise(r=>setImmediate(r))
 assert.equal(vm.data.range.from,'2026-09-01');assert.equal(vm.loading,false)
}))

test('custom range over 92 days never asks the server',withUni(async()=>{
 let calls=0
 const {vm}=mount(async()=>{calls++;return {}})
 vm.choose('custom');assert.equal(calls,0)
 vm.from='2026-06-01';vm.to='2026-09-26';vm.today='2026-09-26'
 vm.query()
 assert.equal(calls,0);assert.equal(vm.rangeError,'一次最多查看92天，请缩短日期范围')
 vm.from='2026-08-01';vm.to='2026-08-31';vm.query();await new Promise(r=>setImmediate(r))
 assert.equal(calls,1);assert.equal(vm.rangeError,'')
}))

test('custom range query goes to the server with the chosen dates',withUni(async()=>{
 const urls=[]
 const {vm}=mount(async url=>{urls.push(url);return {range:{from:'2026-08-01',to:'2026-08-31'}}})
 vm.choose('custom');vm.from='2026-08-01';vm.to='2026-08-31';vm.query();await new Promise(r=>setImmediate(r))
 assert.equal(urls[0],'/staff/manage/dashboard?range=custom&from=2026-08-01&to=2026-08-31')
}))

test('a failed update keeps the last figures',withUni(async()=>{
 let fail=false
 const {vm}=mount(async()=>{if(fail)throw Error('网络不稳定');return {range:{from:'2026-09-01',to:'2026-09-26'},sales:{net:100}}})
 await vm.load();const before=vm.data
 fail=true;await vm.refresh()
 assert.equal(vm.data,before);assert.equal(vm.loaded,true);assert.equal(vm.error,'网络不稳定')
 assert.equal(vm.figures[0].value,'¥1.00')
}))

test('to-do opens the module or explains who handles it',withUni(async toasts=>{
 const shipper=mount(async()=>({todo:{pendingShipment:1}}),{bound:true,canViewDashboard:true,canViewOrders:true,canShip:true})
 await shipper.vm.load()
 shipper.vm.open(shipper.vm.todos[0])
 assert.deepEqual(shipper.emitted,[['open-module',{module:'orders',view:'shipping'}]])
 const finance=mount(async()=>({todo:{pendingShipment:1}}),{bound:true,canViewDashboard:true,canViewOrders:true,canViewMoney:true,canReviewWithdrawals:true})
 await finance.vm.load()
 finance.vm.open(finance.vm.todos[0])
 assert.deepEqual(finance.emitted,[]);assert.deepEqual(toasts,['这类事项由有相应权限的同事处理'])
 finance.vm.open(finance.vm.todos[3])
 assert.deepEqual(finance.emitted,[['open-module',{module:'withdrawals'}]])
 finance.vm.open(finance.vm.todos[5])
 assert.match(toasts.at(-1),/电脑后台/)
}))

test('permission wording asks the workbench to re-check',withUni(async()=>{
 const {vm,emitted}=mount(async()=>{throw Error('当前岗位无权查看经营数据')})
 await vm.load()
 assert.ok(emitted.some(e=>e[0]==='access-change'))
 const stale=mount(async()=>{throw Object.assign(Error('登录状态已变更，请刷新后重试'),{staleSession:true})})
 await stale.vm.load()
 assert.equal(stale.vm.error,'');assert.deepEqual(stale.emitted,[])
}))

test('an answer that arrives after leaving the module is dropped',withUni(async()=>{
 let resolve
 const {vm,component}=mount(()=>new Promise(r=>{resolve=r}))
 const p=vm.load();component.beforeUnmount.call(vm)
 resolve({sales:{net:1}});await p
 assert.equal(vm.data,null);assert.equal(vm.loaded,false)
}))
