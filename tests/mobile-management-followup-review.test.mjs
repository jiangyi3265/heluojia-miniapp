import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni} from './staff-component-harness.mjs'

// Independent follow-up of the first session fixes: real component state,
// local session/request/uni stand-ins. No live service or native UI involved.
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const workbench=await loadHelpers('../services/staff-workbench.js')
const {formatDate}=await loadHelpers('../services/display.js')
const manager={bound:true,canViewOrders:true,canShip:true,canViewProducts:true,canEditProducts:true,canViewStock:true,canHandleCases:true}
const catalog={bound:true,canViewProducts:true,canEditProducts:true,canViewStock:true,canViewOrders:false}
const shipping={bound:true,canViewOrders:true,canShip:true}

async function withUni(run){
 const prior=globalThis.uni;globalThis.uni=fakeUni([],true)
 try{return await run()}finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
}

function bench(initial){
 const loaded=loadComponent('../pages/staff/components/StaffWorkbench.vue',{
  ...workbench,UiIcon:{},StaffModeSwitch:{},StaffManagementPanel:{},StaffDashboard:{},StaffDistributors:{},StaffSettings:{},StaffLookup:{},StaffCustomers:{},
  managementModules:management.managementModules,menuDense:management.menuDense,request:async()=>assert.fail('applyMe must only consume verified capabilities'),
  getToken:()=>'same-session',notify(){},asset:x=>x,formatDate,switchToCustomerView(){}
 })
 loaded.vm.applyMe(initial);loaded.vm.activeModule='products';loaded.vm.menuOpen=false;loaded.vm.moduleBusy=true
 return loaded
}

test('岗位撤销当前商品模块但保留订单权限，卸载旧子模块后不能留下菜单锁',()=>withUni(async()=>{
 const {vm}=bench(manager)
 vm.applyMe(shipping)
 assert.equal(vm.state,'ok');assert.equal(vm.activeModule,'orders')
 assert.equal(vm.modules.some(m=>m.key==='products'),false)
 assert.equal(vm.moduleBusy,false,'the removed child can no longer release a parent lock after unmount')
 vm.showModuleMenu();assert.equal(vm.menuOpen,true)
}))

test('商品岗没有订单权限但当前模块仍可用，刷新身份不得提前解锁商品保存',()=>withUni(async()=>{
 const {vm}=bench(catalog)
 assert.equal(vm.state,'no-orders');assert.ok(vm.modules.some(m=>m.key==='products'))
 vm.applyMe({...catalog})
 assert.equal(vm.activeModule,'products');assert.equal(vm.moduleBusy,true,'no-orders is not loss of product-management access')
 vm.showModuleMenu();assert.equal(vm.menuOpen,false)
 await vm.chooseModule('stocks');assert.equal(vm.activeModule,'products')
}))

test('店长仍允许当前商品模块时也保留在途写入锁',()=>withUni(async()=>{
 const {vm}=bench(manager)
 vm.applyMe({...manager})
 assert.equal(vm.state,'ok');assert.equal(vm.activeModule,'products');assert.equal(vm.moduleBusy,true)
 vm.showModuleMenu();assert.equal(vm.menuOpen,false)
}))

function casePanel(session,request){
 return loadComponent('../pages/staff/components/StaffManagementPanel.vue',{
  ...management,CaseProofs:{},request,getToken:()=>session.token,asset:x=>x,yuan:workbench.yuan,formatDate,
  caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:String
 },{module:'cases',me:manager})
}
const row=status=>({id:91,member_id:92,query_customer:'退换货顾客',order_no:'CASE-91',type:'exchange',status,items_json:'[]'})

for(const status of ['returned','awaiting_reship']){
 test('售后'+status+'打开表单预读仓库遇会话失效时通知父页面，而非静默无反应',()=>withUni(async()=>{
  const session={token:'expired-case-session'},calls=[]
  const {vm,emitted}=casePanel(session,async path=>{
   calls.push(path);session.token='';throw Object.assign(Error('请先登录'),{uncertain:false})
  })
  vm.loaded=true;await vm.editCase(row(status))
  assert.deepEqual(calls,['/staff/manage/stocks']);assert.equal(session.token,'');assert.equal(vm.editor,null)
  assert.equal(emitted.filter(e=>e[0]==='access-change').length,1,'the actual signed-out response must reach parent recovery')
 }))
}

test('售后仓库预读的旧会话失败不影响后来登录的新账号',()=>withUni(async()=>{
 const session={token:'old-case-session'},calls=[]
 const {vm,emitted}=casePanel(session,async path=>{
  calls.push(path);session.token='new-account-session'
  throw Object.assign(Error('登录状态已变更，请刷新后重试'),{staleSession:true})
 })
 vm.loaded=true;await vm.editCase(row('returned'))
 assert.deepEqual(calls,['/staff/manage/stocks']);assert.equal(vm.error,'');assert.equal(vm.editor,null)
 assert.equal(vm.opening,null,'the 正在打开… hint does not stay on the button');assert.deepEqual(emitted,[])
}))
