import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni} from './staff-component-harness.mjs'

// Real component methods and Vue reactivity; session/request/uni are local stand-ins.
// This is a component-state regression, not browser, live-backend, or device evidence.
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const workbench=await loadHelpers('../services/staff-workbench.js')
const {formatDate}=await loadHelpers('../services/display.js')
const allowed={bound:true,name:'会话回归财务',roleLabel:'店长',canViewOrders:true,canShip:true,canReviewWithdrawals:true,canViewProducts:true}
const selector=()=>({in(){return this},select(){return this},boundingClientRect(){return this},selectViewport(){return this},scrollOffset(){return this},exec(fn){fn([{top:180},{scrollTop:0}])}})

async function withUni(run){
 const prior=globalThis.uni
 globalThis.uni=fakeUni([],true,{createSelectorQuery:selector})
 try{return await run()}finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
}

function panel(module,request,session){
 return loadComponent('../pages/staff/components/StaffManagementPanel.vue',{
  ...management,CaseProofs:{},request,getToken:()=>session.token,asset:x=>x,yuan:workbench.yuan,formatDate,
  caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:String
 },{module,me:allowed})
}

function editValid(vm,module){
 vm.loaded=true
 if(module==='products'){
  vm.editProduct({id:31,name:'会话回归商品',spec:'100ml',price:1000,detail:'有效说明',enabled:true,version:2})
  vm.editor.price='12.00'
  return {path:'/staff/manage/products/31',body:{version:2,base:{name:'会话回归商品',spec:'100ml',price:1000,detail:'有效说明',enabled:true},name:'会话回归商品',spec:'100ml',price:1200,detail:'有效说明',enabled:true}}
 }
 if(module==='stocks'){
  vm.editStock({product_id:31,warehouse_id:7,warehouse_name:'测试仓',product_name:'会话回归商品',channel:'C',available:5})
  vm.editor.delta='2';vm.editor.note='盘点补齐';vm.editor.requestKey='session-review-stock-31'
  return {path:'/staff/manage/stocks',body:{productId:31,warehouseId:7,channel:'C',delta:2,note:'盘点补齐',requestKey:'session-review-stock-31'}}
 }
 if(module==='members'){
  vm.editMember({id:32,nickname:'申请人',distributor_state:'pending',distributor_data:'{"name":"回归申请人"}'},'distributor')
  vm.editor.note='资料已核对'
  return {path:'/staff/manage/members/32/distributor',body:{state:'approved',note:'资料已核对'}}
 }
 if(module==='cases'){
  vm.editCase({id:33,member_id:32,query_customer:'回归顾客',order_no:'SESSION-33',status:'pending',type:'refund',amount:1200,items_json:'[]'})
  vm.editor.note='退款依据已核对'
  return {path:'/staff/manage/cases/33',body:{action:'approve',note:'退款依据已核对'}}
 }
 vm.editWithdrawal({id:34,member_id:32,realName:'回归推广员',amount:1200,fee:0,tax_amount:0,service_fee:0,review_status:'pending',canApprove:true},'approve')
 vm.editor.note='收款资料已核对'
 return {path:'/staff/manage/withdrawals/34',body:{state:'approve',note:'收款资料已核对'}}
}

for(const module of ['products','stocks','members','cases','withdrawals']){
 test('有效'+module+'写入收到登录失效后通知父级重新读取身份',()=>withUni(async()=>{
  const session={token:'old-session'},calls=[]
  const {vm,emitted}=panel(module,async(path,method,body)=>{
   calls.push({path,method,body});session.token=''
   throw Object.assign(Error('请先登录'),{uncertain:false})
  },session)
  const expected=editValid(vm,module)
  await vm.submit()
  assert.deepEqual(calls,[{...expected,method:'POST'}],'validation must reach one valid write, not fail before auth')
  assert.equal(vm.busy,false)
  assert.deepEqual(emitted.filter(e=>e[0]==='busy'),[['busy',true],['busy',false]])
  assert.equal(emitted.filter(e=>e[0]==='access-change').length,1,'expired write must expose the parent login exit')
 }))
}

test('有效提现写入被明确无权拒绝后刷新权限，不扩大权限或重发',()=>withUni(async()=>{
 const session={token:'same-session'},calls=[]
 const {vm,emitted}=panel('withdrawals',async(path,method,body)=>{
  calls.push({path,method,body});throw Object.assign(Error('当前岗位无权审核提现'),{uncertain:false})
 },session)
 const expected=editValid(vm,'withdrawals');await vm.submit()
 assert.deepEqual(calls,[{...expected,method:'POST'}]);assert.equal(vm.formError,'当前岗位无权审核提现','the refusal is shown on the form')
 assert.equal(vm.busy,false);assert.equal(vm.uncertain,false)
 assert.equal(emitted.filter(e=>e[0]==='access-change').length,1,'plain 无权 must trigger a fresh capability read')
}))

test('旧写请求遇到另一个已登录账号时不把旧错误通知给新账号',()=>withUni(async()=>{
 const session={token:'old-session'},calls=[]
 const {vm,emitted}=panel('withdrawals',async(path,method,body)=>{
  calls.push({path,method,body});session.token='new-account-session'
  throw Object.assign(Error('登录状态已变更，请刷新后重试'),{staleSession:true})
 },session)
 const expected=editValid(vm,'withdrawals');await vm.submit()
 assert.deepEqual(calls,[{...expected,method:'POST'}]);assert.ok(vm.editor,'the form stays as it was')
 assert.equal(vm.formError,'');assert.equal(vm.uncertain,false);assert.equal(vm.busy,false)
 assert.deepEqual(emitted.filter(e=>e[0]==='access-change'),[])
}))

test('仍登录的网络不确定提现保持原表单锁定，不能当成过期解锁重发',()=>withUni(async()=>{
 const session={token:'same-session'},calls=[]
 const {vm,emitted}=panel('withdrawals',async(path,method,body)=>{
  calls.push({path,method,body});throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})
 },session)
 const expected=editValid(vm,'withdrawals');await vm.submit();await vm.submit()
 assert.deepEqual(calls,[{...expected,method:'POST'}]);assert.ok(vm.editor)
 assert.equal(vm.uncertain,true);assert.equal(vm.busy,false)
 assert.deepEqual(emitted.filter(e=>e[0]==='access-change'),[])
}))

function bench(session,{expireOnRead=false}={}){
 const requests=[]
 const request=async path=>{
  requests.push(path)
  if(expireOnRead){session.token='';throw Error('登录已过期，请重新登录')}
  if(path==='/staff/me')return {...allowed}
  if(path==='/staff/overview')return {pendingShipment:0,pendingPickup:0,afterSalesOpen:0}
  if(path.startsWith('/staff/orders?'))return {rows:[],total:0}
  throw Error('unexpected request '+path)
 }
 const loaded=loadComponent('../pages/staff/components/StaffWorkbench.vue',{
  ...workbench,UiIcon:{},StaffModeSwitch:{},StaffManagementPanel:{},StaffDashboard:{},StaffDistributors:{},StaffSettings:{},StaffLookup:{},StaffCustomers:{},
  managementModules:management.managementModules,menuDense:management.menuDense,request,getToken:()=>session.token,notify(){},asset:x=>x,formatDate,switchToCustomerView(){}
 })
 loaded.vm.applyMe({...allowed});loaded.vm.moduleBusy=true
 return {...loaded,requests}
}

const lossScenarios=[
 {name:'refresh开始时已无token',state:'login',run:async(vm,session)=>{session.token='';await vm.refresh()}},
 {name:'refresh身份响应拒绝登录',state:'login',options:{expireOnRead:true},run:async vm=>vm.refresh()},
 {name:'applyMe员工解绑或停用',state:'unbound',run:async vm=>vm.applyMe({bound:false,disabled:true})},
 {name:'loginLost检测到会话清除',state:'login',run:async(vm,session)=>{session.token='';assert.equal(vm.loginLost(),true)}}
]
for(const scenario of lossScenarios){
 test(scenario.name+'清掉已卸载子模块的残留锁，恢复后能切菜单',()=>withUni(async()=>{
  const session={token:'old-session'}, {vm}=bench(session,scenario.options)
  await scenario.run(vm,session)
  assert.equal(vm.state,scenario.state)
  assert.equal(vm.moduleBusy,false,'an inaccessible/unmounted child must not leave the parent locked')
  session.token='renewed-session';vm.applyMe({...allowed})
  await vm.chooseModule('withdrawals')
  assert.equal(vm.state,'ok');assert.equal(vm.activeModule,'withdrawals');assert.equal(vm.menuOpen,false)
  vm.showModuleMenu();assert.equal(vm.menuOpen,true,'the restored session can return to the menu')
 }))
}

test('仍有权限的刷新不能提前解除真实子提交锁或切换模块',()=>withUni(async()=>{
 const session={token:'same-session'},{vm,requests}=bench(session)
 await vm.refresh()
 assert.ok(requests.includes('/staff/me'));assert.equal(vm.state,'ok');assert.equal(vm.moduleBusy,true)
 await vm.chooseModule('withdrawals');assert.equal(vm.activeModule,'orders')
 vm.menuOpen=false;vm.showModuleMenu();assert.equal(vm.menuOpen,false)
}))

test('loginLost发现仍有有效会话时不解除提交锁',()=>withUni(async()=>{
 const session={token:'new-account-session'},{vm}=bench(session)
 assert.equal(vm.loginLost(),false);assert.equal(vm.state,'ok');assert.equal(vm.moduleBusy,true)
}))
