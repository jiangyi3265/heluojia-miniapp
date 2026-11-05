import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const helpers=await loadHelpers('../pages/staff/services/staff-settings.js')

const sample=()=>({canEdit:true,
 withdrawal:{values:{withdrawMinimum:1000,withdrawFee:100,withdrawTaxRate:2000,withdrawWorkingDays:3,withdrawMaxAmount:20000}},
 serviceFee:{distributorServiceRate:100},
 delivery:{base:'3f1a9c',methods:['express','pickup'],
  rules:[{index:0,method:'express',methodLabel:'快递配送',regionsText:'未单独设置的地区',first:1,next:1,firstFee:1000,nextFee:500,remoteFee:0,freeAmount:9900}],
  points:[{id:'point_1727000000000_ab12cd',name:'赫洛嘉旗舰店',address:'长沙市岳麓区示例路 1 号',hours:'每天 9:00-21:00',warehouseId:1,warehouseName:'长沙主仓',warehouseEnabled:true,pendingPickups:2}],
  warehouses:[{id:1,name:'长沙主仓'}],notice:'下单后 48 小时内发货'}})
const manager={bound:true,canViewShopSettings:true,canEditShopSettings:true}
const finance={bound:true,canViewShopSettings:true,canEditShopSettings:false}

function mount(server,me=manager){
 const calls=[]
 const request=async(path,method='GET',body)=>{calls.push({path,method,body:body&&JSON.parse(JSON.stringify(body))});return server(path,method,body)}
 const deps={request,getToken:()=>'staff-token',...management,...helpers}
 return {...loadComponent('../pages/staff/components/StaffSettings.vue',deps,{module:'settings',me}),calls}
}
function withUni(fn){return async()=>{const toasts=[],modals=[];globalThis.uni=fakeUni(toasts,o=>{modals.push(o);return true});try{await fn(toasts,modals)}finally{delete globalThis.uni}}}

test('finance sees settings read-only',withUni(async()=>{
 const {vm}=mount(async()=>({...sample(),canEdit:false}),finance)
 await vm.load()
 assert.equal(vm.canEdit,false);vm.openWithdrawal();assert.equal(vm.editor,null)
 const b=mount(async()=>sample(),finance);await b.vm.load()
 assert.equal(b.vm.canEdit,false,'the me flag also has to allow editing')
}))

test('saving sends what was loaded as base and the full new section',withUni(async(toasts,modals)=>{
 const {vm,calls}=mount(async(path,method)=>method==='POST'?{changed:true,settings:{}}:sample())
 await vm.load()
 vm.openWithdrawal();vm.editor.form.withdrawMinimum='20'
 await vm.submit()
 const post=calls.find(c=>c.method==='POST')
 assert.equal(post.path,'/staff/manage/settings/withdrawal')
 assert.deepEqual(post.body,{base:sample().withdrawal.values,values:{...sample().withdrawal.values,withdrawMinimum:2000}})
 assert.equal(modals[0].content,'最低提现金额：¥10.00 → ¥20.00\n确认保存？');assert.equal(modals[0].title,'保存提现规则')
 assert.equal(calls.at(-1).method,'GET');assert.equal(calls.filter(c=>c.method==='GET').length,2)
 assert.equal(vm.editor,null);assert.equal(toasts.at(-1),'已保存');assert.equal(vm.busy,false)
}))

test('service fee save sends the loaded rate as base',withUni(async()=>{
 const {vm,calls}=mount(async(path,method)=>method==='POST'?{changed:true}:sample())
 await vm.load();vm.openService();assert.equal(vm.editor.percent,'1');vm.editor.percent='1.5'
 await vm.submit()
 const post=calls.find(c=>c.method==='POST')
 assert.equal(post.path,'/staff/manage/settings/service-fee');assert.deepEqual(post.body,{base:{distributorServiceRate:100},values:{distributorServiceRate:150}})
}))

test('delivery save sends the loaded fingerprint and patches',withUni(async()=>{
 const {vm,calls}=mount(async(path,method)=>method==='POST'?{changed:true}:sample())
 await vm.load();vm.openDelivery()
 vm.editor.form.rules[0].firstFee='12'
 vm.addPoint();Object.assign(vm.editor.form.points[1],{name:'梅溪湖店',address:'长沙市岳麓区梅溪湖路88号'})
 vm.pickWarehouse(vm.editor.form.points[1],{detail:{value:0}})
 await vm.submit()
 const post=calls.find(c=>c.method==='POST')
 assert.equal(post.path,'/staff/manage/settings/delivery');assert.equal(post.body.base,'3f1a9c')
 assert.deepEqual(Object.keys(post.body.rules[0]).sort(),['firstFee','freeAmount','index','nextFee','remoteFee'])
 assert.equal(post.body.rules[0].firstFee,1200)
 assert.deepEqual(post.body.points[1],{id:'',name:'梅溪湖店',address:'长沙市岳麓区梅溪湖路88号',hours:'',warehouseId:1})
 assert.deepEqual(post.body.methods,['express','pickup'])
}))

test('removing a store asks first and names its waiting pickups',withUni(async(toasts,modals)=>{
 const {vm}=mount(async()=>sample())
 await vm.load();vm.openDelivery()
 await vm.removePoint(0)
 assert.equal(modals[0].content,'「赫洛嘉旗舰店」还有 2 笔待自提订单。删除后这些订单仍按原门店信息取货，新订单不能再选这家门店。确认删除？')
 assert.equal(vm.editor.form.points.length,0)
 await vm.submit()
 assert.equal(vm.formError,'开启门店自提前请至少保留一个门店')
}))

test('refresh never replaces values under an open editor',withUni(async()=>{
 const {vm,calls}=mount(async()=>sample())
 await vm.load();const base=vm.base
 vm.openWithdrawal();const n=calls.length
 await vm.refresh()
 assert.equal(calls.length,n);assert.equal(vm.base,base)
}))

// Review finding: a refresh answer that lands after an editor opened used to replace `base` under it, so the save sent the
// newer base with the older form values, the server's "changed since" check passed and a PC change was silently undone.
test('a read on its way keeps editors shut, and a late answer never changes what an open editor compares with or sends',withUni(async(toasts,modals)=>{
 const pc=()=>{const s=sample();s.withdrawal.values.withdrawFee=200;s.delivery.base='9e8d7c';s.delivery.warehouses=[{id:1,name:'长沙主仓'},{id:2,name:'株洲仓'}];return s}
 let answer=sample,hold=null
 const {vm,calls}=mount((path,method)=>{
  if(method==='POST')return Promise.resolve({changed:true})
  if(hold)return new Promise(r=>{const h=hold;hold=null;h(()=>r(answer()))})
  return Promise.resolve(answer())
 })
 await vm.load()
 // 1. Pull-down refresh on a slow network: the edit buttons do nothing until the answer is in.
 let release;hold=f=>{release=f};answer=pc
 const refreshing=vm.refresh()
 assert.equal(vm.loading,true)
 vm.openWithdrawal();vm.openService();vm.openDelivery()
 assert.equal(vm.editor,null,'no editor while a read is on its way')
 release();await refreshing
 vm.openWithdrawal()
 assert.equal(vm.editor.form.withdrawFee,'2.00','the form shows the value that just arrived')
 vm.closeEditor()
 // 2. An answer that arrives after an editor opened (any read) only changes the page behind it.
 vm.openWithdrawal()
 hold=f=>{release=f};answer=()=>{const s=pc();s.withdrawal.values.withdrawFee=300;return s}
 const late=vm.load();release();await late
 assert.equal(vm.base.withdrawal.values.withdrawFee,300,'the page behind the editor is up to date')
 vm.editor.form.withdrawMinimum='20'
 await vm.submit()
 const post=calls.find(c=>c.method==='POST')
 assert.deepEqual(post.body.base,pc().withdrawal.values,'sends the values the form was filled from, so the server can spot the change')
 assert.equal(post.body.values.withdrawFee,200)
 assert.equal(modals.at(-1).content,'最低提现金额：¥10.00 → ¥20.00\n确认保存？','the confirm text compares with the same values')
 // 3. The same for delivery: the fingerprint and the store list come from when the editor opened.
 answer=pc;await vm.load();vm.openDelivery()
 assert.equal(vm.warehouses.length,2)
 hold=f=>{release=f};answer=sample
 const late2=vm.load();release();await late2
 assert.equal(vm.warehouses.length,2,'the picker keeps the list it opened with')
 vm.editor.form.rules[0].firstFee='12'
 await vm.submit()
 const post2=calls.filter(c=>c.method==='POST').at(-1)
 assert.equal(post2.path,'/staff/manage/settings/delivery');assert.equal(post2.body.base,'9e8d7c')
}))

test('stale refusal offers reloading and keeps the form usable',withUni(async()=>{
 const {vm,calls}=mount(async(path,method)=>{if(method==='POST')throw Error('设置刚被别人改过，请刷新后再改');return sample()})
 await vm.load();vm.openWithdrawal();vm.editor.form.withdrawMinimum='20'
 await vm.submit()
 assert.equal(vm.stale,true);assert.equal(vm.uncertain,false);assert.equal(vm.formError,'设置刚被别人改过，请刷新后再改');assert.equal(vm.locked,false)
 vm.reloadLatest();await settle()
 assert.equal(vm.editor,null);assert.equal(vm.stale,false);assert.equal(calls.at(-1).method,'GET')
}))

test('uncertain save locks the form',withUni(async()=>{
 const {vm,calls}=mount(async(path,method)=>{if(method==='POST')throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true});return sample()})
 await vm.load();vm.openWithdrawal();vm.editor.form.withdrawMinimum='20'
 await vm.submit()
 assert.equal(vm.uncertain,true);assert.equal(vm.locked,true)
 await vm.submit()
 assert.equal(calls.filter(c=>c.method==='POST').length,1)
}))

test('a value that did not stick is reported',withUni(async()=>{
 const {vm}=mount(async(path,method)=>method==='POST'?{changed:true}:sample())
 await vm.load();vm.openWithdrawal();vm.editor.form.withdrawMaxAmount='300'
 await vm.submit()
 assert.match(vm.notice,/和刚才填写的不一致/);assert.match(vm.notice,/单笔提现最多到账是 ¥200\.00/)
 vm.openWithdrawal();assert.equal(vm.notice,'')
}))

test('a failed read after saving does not claim a mismatch',withUni(async()=>{
 let reads=0
 const {vm}=mount(async(path,method)=>{if(method==='POST')return {changed:true};if(++reads>1)throw Error('暂时连接失败');return sample()})
 await vm.load();vm.openWithdrawal();vm.editor.form.withdrawMinimum='20'
 await vm.submit()
 assert.equal(vm.notice,'');assert.equal(vm.error,'暂时连接失败')
}))

test('cancelled confirmation sends nothing and ends busy',async()=>{
 globalThis.uni=fakeUni([],false)
 try{
  const {vm,calls,emitted}=mount(async()=>sample())
  await vm.load();vm.openService();vm.editor.percent='2'
  await vm.submit()
  assert.equal(calls.filter(c=>c.method==='POST').length,0);assert.equal(vm.busy,false)
  assert.deepEqual(emitted.filter(e=>e[0]==='busy').map(e=>e[1]),[true,false])
 }finally{delete globalThis.uni}
})
