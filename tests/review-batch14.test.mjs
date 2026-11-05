import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// 复核第 14 批：审查 Codex 两轮“手机后台复查”后找出的问题（工作台 WB、管理面板 MP、分销商 DS、上传 UP、提现规则 RL）。
// 真实组件的 data/computed/methods 与 Vue 响应式；会话、接口、原生界面都是本地替身，不是真机或真实后端证据。
const require=createRequire(import.meta.url)
const {createSSRApp}=require('vue'),{renderToString}=require('vue/server-renderer')
const w=await loadHelpers('../services/staff-workbench.js')
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const distributors=await loadHelpers('../pages/staff/services/staff-distributors.js')
const {formatDate}=await loadHelpers('../services/display.js')
const {withdrawalRuleRows}=await loadHelpers('../services/withdrawal-guidance.js')
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const ticks=async(n=8)=>{for(let i=0;i<n;i++)await settle()}
const role={bound:true,canViewOrders:true,canShip:true,canCollectPickup:true,canViewProducts:true,canEditProducts:true,canViewStock:true,canAdjustStock:true,canViewCases:true,canHandleCases:true,canReviewWithdrawals:true}
const manager={bound:true,canReviewCustomers:true,canViewCustomers:true,canViewDistributors:true,canRegisterPartnerFees:true,canManageDistributors:true}
const order={id:73,orderNo:'LOCAL-73',status:'paid',deliveryMethod:'express',shippable:true,items:[]}
const pickup={id:74,orderNo:'LOCAL-74',status:'paid',deliveryMethod:'pickup',pickupStatus:'ready',collectable:true,preparable:true,items:[]}
const caseA={id:81,type:'exchange',status:'returned',items_json:'[]',order_no:'A',amount:0}
const caseC={id:83,type:'resend',status:'awaiting_reship',items_json:'[]',order_no:'C',amount:0}
const changed='登录状态已变化，请重新操作'

async function withUni(run,toasts=[],extra={},confirm=true){
 const prior=globalThis.uni;globalThis.uni=fakeUni(toasts,confirm,extra)
 try{return await run()}finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
}
async function render(rel,vm){
 const template=readFileSync(new URL(rel,import.meta.url),'utf8').match(/<template>([\s\S]*)<\/template>\s*<script>/)[1]
 const app=createSSRApp({template,setup:()=>vm,components:{CaseProofs:{props:['heading','count'],template:'<i>{{heading||"已上传的图片凭证"}}</i>'}}})
 app.config.compilerOptions.isCustomElement=tag=>['view','text','image','input','textarea','picker','switch','scroll-view'].includes(tag)
 app.config.warnHandler=()=>{}
 return (await renderToString(app)).replace(/<!--[\s\S]*?-->/g,'')
}

// ---------- 商家工作台（StaffWorkbench.vue） ----------
function bench(session,answer,me=role){
 const calls=[],notified=[]
 const loaded=loadComponent('../pages/staff/components/StaffWorkbench.vue',{...w,UiIcon:{},StaffModeSwitch:{},StaffManagementPanel:{},StaffDashboard:{},StaffDistributors:{},StaffSettings:{},StaffLookup:{},StaffCustomers:{},
  managementModules:management.managementModules,menuDense:management.menuDense,
  request:async(path,method,body)=>{calls.push({path,method:method||'GET',token:session.token});return answer(path,method,body)},
  getToken:()=>session.token,notify:e=>notified.push(e.message),asset:x=>x,formatDate,switchToCustomerView(){}})
 loaded.vm.applyMe({...me})
 return {...loaded,calls,notified}
}
const posts=calls=>calls.filter(c=>c.method==='POST')
function shipForm(vm){vm.view='shipping';vm.rows=[order];vm.total=1;vm.listLoaded=true;vm.openShip(order);vm.shipSheet.carrier='顺丰速运';vm.shipSheet.tracking='SF1234567890'}

test('WB-1 发货成功后只等订单列表刷新完就解锁：经营数据慢，不再挡住下一单（审查 P3-1）',()=>withUni(async()=>{
 const overview=deferred(),{vm,calls}=bench({token:'a'},async(path,method)=>method==='POST'?{}:path==='/staff/overview'?overview.promise:path.startsWith('/staff/orders')?{rows:[{...order,id:75,orderNo:'LOCAL-75'}],total:1}:role)
 shipForm(vm);const job=vm.submitShip();await ticks()
 assert.equal(posts(calls).length,1)
 assert.deepEqual(vm.rows.map(r=>r.id),[75],'列表已经是发货后的样子')
 assert.equal(vm.busy,false,'锁只等订单列表，不等经营数据')
 assert.equal(vm.refreshing,false)
 overview.resolve({pendingShipment:0});await job
}))

test('WB-1b 写入后刷新订单期间页面显示“正在刷新订单…”，刷新完收起（审查 P3-1：锁住时要有提示）',()=>withUni(async()=>{
 const list=deferred(),{vm}=bench({token:'a'},async(path,method)=>method==='POST'?{}:path==='/staff/overview'?{}:path.startsWith('/staff/orders')?list.promise:role)
 shipForm(vm);const job=vm.submitShip();await ticks()
 assert.equal(vm.busy,true);assert.equal(vm.refreshing,true)
 assert.match(await render('../pages/staff/components/StaffWorkbench.vue',vm),/正在刷新订单…/)
 list.resolve({rows:[],total:0});await job
 assert.equal(vm.busy,false);assert.equal(vm.refreshing,false)
 assert.doesNotMatch(await render('../pages/staff/components/StaffWorkbench.vue',vm),/正在刷新订单…/)
}))

test('WB-2 写入前已有一次订单读取在途：锁持到写入之后发出的那次重读完成，旧读取的结果不显示（审查 P3-2）',()=>withUni(async()=>{
 const first=deferred(),second=deferred();let reads=0
 const {vm,calls}=bench({token:'a'},async(path,method)=>method==='POST'?{}:path==='/staff/overview'?{}:path.startsWith('/staff/orders')?(++reads===1?first.promise:second.promise):role)
 vm.view='shipping';vm.rows=[order];vm.total=1;vm.listLoaded=true
 const before=vm.loadList(false)
 vm.openShip(order);vm.shipSheet.carrier='顺丰速运';vm.shipSheet.tracking='SF1234567890'
 const job=vm.submitShip();await ticks()
 assert.equal(posts(calls).length,1)
 assert.equal(vm.busy,true,'更早发出的读取还没回来，不能解锁')
 first.resolve({rows:[{...order,orderNo:'STALE'}],total:1});await before;await ticks()
 assert.equal(reads,2,'旧读取回来后立刻再读一次')
 assert.equal(vm.busy,true);assert.notEqual(vm.rows[0]?.orderNo,'STALE','写入前的读取结果不能当成最新状态显示')
 second.resolve({rows:[],total:0});await job
 assert.equal(vm.busy,false);assert.deepEqual(vm.rows,[])
}))

test('WB-3 确认框打开期间换成另一个账号：不提交，提示“登录账号已变化”，并按新账号重新加载（审查 P3-3）',async()=>{
 const toasts=[],session={token:'a'}
 await withUni(async()=>{
  const {vm,calls}=bench(session,async(path,method)=>method==='POST'?assert.fail('不能以任何账号提交上一个账号界面上的发货'):path==='/staff/overview'?{}:path.startsWith('/staff/orders')?{rows:[],total:0}:role)
  shipForm(vm);await vm.submitShip();await ticks()
  assert.equal(posts(calls).length,0)
  assert.ok(toasts.includes(changed),'要告诉员工发生了什么，不能无声关掉表单')
  assert.ok(calls.some(c=>c.path==='/staff/me'&&c.token==='b'),'按现在登录的账号重新加载')
  assert.equal(vm.shipSheet,null);assert.equal(vm.busy,false);assert.equal(vm.state,'ok')
 },toasts,{},()=>{session.token='b';return true})
})

for(const kind of ['ship','pickup','prepare'])test('WB-4 '+kind+'：表单打开后（或点按钮前）换了账号，提交时拦下，不以新账号身份提交旧账号界面上的订单（审查 P3-4）',async()=>{
 const toasts=[],session={token:'a'}
 await withUni(async()=>{
  const {vm,calls}=bench(session,async(path,method)=>method==='POST'?{}:path==='/staff/overview'?{}:path.startsWith('/staff/orders')?{rows:[],total:0}:role)
  if(kind==='ship')shipForm(vm)
  else{vm.view='pickup';vm.rows=[pickup];vm.total=1;vm.listLoaded=true;if(kind==='pickup'){vm.openPickup(pickup);vm.pickupSheet.code='12345678'}}
  session.token='b'
  if(kind==='ship')await vm.submitShip();else if(kind==='pickup')await vm.submitPickup();else await vm.prepare(pickup)
  await ticks()
  assert.equal(posts(calls).length,0)
  assert.ok(toasts.includes(changed))
  assert.ok(calls.some(c=>c.path==='/staff/me'&&c.token==='b'))
  assert.equal(vm.busy,false)
 },toasts)
})

test('WB-4b 同一账号正常提交不受影响（发货、备货、核销各一次）',()=>withUni(async()=>{
 const {vm,calls}=bench({token:'a'},async(path,method)=>method==='POST'?{}:path==='/staff/overview'?{}:path.startsWith('/staff/orders')?{rows:[],total:0}:role)
 shipForm(vm);await vm.submitShip()
 vm.view='pickup';vm.rows=[pickup];await vm.prepare(pickup)
 vm.rows=[pickup];vm.openPickup(pickup);vm.pickupSheet.code='12345678';await vm.submitPickup()
 assert.deepEqual(posts(calls).map(c=>c.path),['/staff/orders/73/ship','/staff/orders/74/prepare','/staff/pickup/collect'])
 assert.ok(posts(calls).every(c=>c.token==='a'))
}))

test('WB-5 备货“结果不确定”时也持锁到订单列表刷新完，刷新前这一行不能再点（审查 P3-5）',()=>withUni(async()=>{
 const list=deferred(),{vm}=bench({token:'a'},async(path,method)=>{
  if(method==='POST')throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})
  return path==='/staff/overview'?{}:path.startsWith('/staff/orders')?list.promise:role
 })
 vm.view='pickup';vm.rows=[pickup];vm.total=1;vm.listLoaded=true
 const job=vm.prepare(pickup);await ticks()
 assert.ok(vm.busy,'列表刷新回来之前，这一行的“备货完成”仍然锁着')
 list.resolve({rows:[],total:0});await job
 assert.equal(vm.busy,false)
}))

test('WB-6 权限复查后当前标签被撤（例如没了发货权限）：改看剩下的第一个标签并加载，不留空白（审查范围外观察）',()=>withUni(async()=>{
 let me=role
 const {vm,calls}=bench({token:'a'},async path=>{
  if(path==='/staff/me')return me
  if(path==='/staff/overview')return {}
  if(path.startsWith('/staff/orders?view=shipping'))throw Error('你的岗位没有发货权限')
  return {rows:[pickup],total:1}
 })
 vm.view='shipping';me={...role,canShip:false}
 await vm.loadList(false);await ticks()
 assert.equal(vm.view,'pickup')
 assert.ok(calls.some(c=>c.path.startsWith('/staff/orders?view=pickup')),'剩下的标签自动加载')
 assert.equal(vm.listLoaded,true);assert.deepEqual(vm.rows.map(r=>r.id),[74]);assert.equal(vm.listError,'')
}))

test('WB-7 权限复查后没了发货或核销权限：打开着的表单自动关闭；自己的写入还在进行时保留（审查范围外观察）',()=>withUni(async()=>{
 const {vm}=bench({token:'a'},async()=>({}))
 shipForm(vm);vm.applyMe({...role,canShip:false})
 assert.equal(vm.shipSheet,null)
 vm.applyMe({...role});vm.view='pickup';vm.rows=[pickup];vm.openPickup(pickup);vm.busy=true
 vm.applyMe({...role,canCollectPickup:false})
 assert.ok(vm.pickupSheet,'自己的写入还在进行：保留表单，用来显示这次写入的结果')
}))

test('WB-8 同一账号：被后一次刷新取代的旧刷新迟到失败（普通错误），不提示、不改页面（审查 B1：只靠 generation 拦）',()=>withUni(async()=>{
 const old=deferred();let n=0
 const {vm,notified}=bench({token:'a'},async path=>path==='/staff/me'?(++n===1?old.promise:role):path==='/staff/overview'?{}:{rows:[],total:0})
 const first=vm.refresh();await vm.refresh()
 old.reject(Error('无法连接服务，请检查网络后重试'));await first
 assert.deepEqual(notified,[]);assert.equal(vm.state,'ok');assert.equal(vm.loadError,'')
}))

test('WB-9 刷新在途时换了账号、旧刷新以普通错误失败（不带 staleSession）：不提示、不改页面（审查 B1：只靠账号比对拦）',()=>withUni(async()=>{
 const old=deferred(),session={token:'a'}
 const {vm,notified}=bench(session,async path=>path==='/staff/me'?old.promise:path==='/staff/overview'?{}:{rows:[],total:0})
 const first=vm.refresh();session.token='b'
 old.reject(Error('无法连接服务，请检查网络后重试'));await first
 assert.deepEqual(notified,[]);assert.equal(vm.state,'ok');assert.equal(vm.loadError,'')
}))

test('WB-10 换了账号后刷新：先清掉上一个账号的订单、经营数据和表单，再按新账号加载（审查 P3-4 建议）',()=>withUni(async()=>{
 const me=deferred(),session={token:'a'}
 const {vm}=bench(session,async path=>path==='/staff/me'?me.promise:path==='/staff/overview'?{}:{rows:[],total:0})
 shipForm(vm);vm.overview={pendingShipment:1}
 session.token='b';const job=vm.refresh();await ticks(2)
 assert.deepEqual(vm.rows,[]);assert.equal(vm.overview,null);assert.equal(vm.shipSheet,null);assert.equal(vm.me,null);assert.equal(vm.state,'loading')
 me.resolve(role);await job
 assert.equal(vm.state,'ok')
}))

test('WB-5b 发货“结果不确定”：表单锁住不能再提交，但员工可以马上关闭（不用等列表重读，复核 N2）',()=>withUni(async()=>{
 const list=deferred(),{vm,calls}=bench({token:'a'},async(path,method)=>{
  if(method==='POST')throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})
  return path==='/staff/overview'?{}:path.startsWith('/staff/orders')?list.promise:role
 })
 shipForm(vm);await vm.submitShip()
 assert.equal(vm.shipSheet.uncertain,true);assert.equal(vm.busy,false,'锁已释放，“关闭”可以点')
 await vm.submitShip();assert.equal(posts(calls).length,1,'锁住的表单不能再提交')
 vm.closeSheets();assert.equal(vm.shipSheet,null)
 list.resolve({rows:[],total:0});await ticks()
}))

test('WB-11 连续写入时晚到的旧统计不能盖住新数字（复核 N1）',()=>withUni(async()=>{
 const first=deferred(),second=deferred();let n=0
 const {vm}=bench({token:'a'},async path=>path==='/staff/overview'?(++n===1?first.promise:second.promise):{rows:[],total:0})
 const a=vm.loadOverview(),b=vm.loadOverview()
 second.resolve({pendingShipment:0});await b
 first.resolve({pendingShipment:1});await a
 assert.equal(vm.overview.pendingShipment,0);assert.equal(vm.overviewLoading,false)
}))

test('WB-12 “正在刷新订单…”只在正常工作页、没打开表单时显示（复核 N3/N4）',()=>withUni(async()=>{
 const {vm}=bench({token:'a'},async()=>({}))
 vm.view='shipping';vm.rows=[order];vm.refreshing=true
 assert.match(await render('../pages/staff/components/StaffWorkbench.vue',vm),/正在刷新订单…/)
 vm.openShip(order)
 assert.doesNotMatch(await render('../pages/staff/components/StaffWorkbench.vue',vm),/正在刷新订单…/,'表单打开时不压在表单按钮上')
 vm.closeSheets();vm.clearData('login')
 assert.doesNotMatch(await render('../pages/staff/components/StaffWorkbench.vue',vm),/正在刷新订单…/,'“请先登录”页上不显示')
}))

test('WB-13 权限复查时发现已换成另一个账号：整页按新账号重新加载，不把新账号的权限套到旧账号的屏幕上（复核 N11）',()=>withUni(async()=>{
 const session={token:'a'},me=deferred();let reads=0
 const {vm,calls}=bench(session,async path=>{
  if(path==='/staff/me')return ++reads===1?me.promise:{...role,canShip:false}
  if(path==='/staff/overview')return {}
  if(path.startsWith('/staff/orders?view=shipping'))throw Error('你的岗位没有发货权限')
  return {rows:[],total:0}
 })
 vm.view='shipping';vm.rows=[order];vm.listLoaded=true
 const job=vm.loadList(false);await ticks(2);session.token='b';me.resolve({...role,canShip:false});await job;await ticks()
 assert.ok(calls.some(c=>c.path==='/staff/me'&&c.token==='b'),'按新账号重新读取身份')
 assert.ok(!vm.rows.some(r=>r.id===73),'旧账号的订单不留在屏幕上')
}))

// ---------- 管理面板（StaffManagementPanel.vue） ----------
function panel(module,answer,session,me=role){
 const calls=[]
 const loaded=loadComponent('../pages/staff/components/StaffManagementPanel.vue',{...management,CaseProofs:{},
  request:async(path,method,body)=>{calls.push({path,method:method||'GET'});return answer(path,method,body)},
  getToken:()=>session.token,asset:x=>x,yuan:w.yuan,formatDate,caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:String},{module,me})
 return {...loaded,calls}
}
const stock=n=>({stocks:[{product_id:31,warehouse_id:7,warehouse_name:'测试仓',product_name:'回归商品',channel:'C',available:n}],warehouses:[{id:7,name:'测试仓',enabled:true}],movements:[]})
const reads=calls=>calls.filter(c=>c.method==='GET')

test('MP-1 库存：提交前发出的列表读取还没回来时提交成功——提交后重新读取，最后显示提交后的数量（审查 P2-1）',()=>withUni(async()=>{
 const old=deferred();let n=0
 const {vm,calls}=panel('stocks',async(path,method)=>method==='POST'?{}:++n===1?old.promise:stock(8),{token:'a'})
 vm.loaded=true;vm.rows=stock(5).stocks
 const before=vm.refresh()
 vm.editStock(vm.rows[0]);vm.editor.delta='3';vm.editor.note='盘点补齐'
 await vm.submit();await ticks()
 old.resolve(stock(5));await before;await ticks()
 assert.deepEqual(calls.map(c=>c.method),['GET','POST','GET'],'提交成功后要重新读取，不能被在途的旧读取吞掉')
 assert.equal(vm.rows[0].available,8,'写入前的读取迟到，也不能把旧数量放回去')
 assert.equal(vm.loading,false)
}))

test('MP-1b “返回并核对最新状态”：即使有一次旧读取在途，也重新读取（审查 P2-1）',()=>withUni(async()=>{
 const old=deferred();let n=0
 const {vm,calls}=panel('stocks',async()=>++n===1?old.promise:stock(9),{token:'a'})
 vm.loaded=true;vm.rows=stock(5).stocks
 const before=vm.refresh()
 vm.editStock(vm.rows[0]);vm.uncertain=true;vm.closeAndRefresh();await ticks()
 old.resolve(stock(5));await before;await ticks()
 assert.equal(reads(calls).length,2);assert.equal(vm.rows[0].available,9)
}))

test('MP-1c 提现“查询转账结果”之后重新读取列表，不被在途的旧读取吞掉（与 P2-1 同类）',()=>withUni(async()=>{
 const old=deferred(),row={id:34,member_id:32,amount:1200,review_status:'approved',transfer_state:'PROCESSING',canQuery:true};let n=0
 const {vm,calls}=panel('withdrawals',async(path,method)=>method==='POST'?{}:++n===1?old.promise:[{...row,transfer_state:'SUCCESS',canQuery:false}],{token:'a'})
 vm.loaded=true;vm.rows=[row]
 const before=vm.refresh()
 await vm.queryWithdrawal(row);await ticks()
 old.resolve([row]);await before;await ticks()
 assert.deepEqual(calls.map(c=>c.method),['GET','POST','GET'])
 assert.equal(vm.rows[0].transfer_state,'SUCCESS')
}))

test('MP-2 售后：读仓库期间列表刷新了一次，“处理售后”照样打开，不会无声无反应（审查 P3-1）',()=>withUni(async()=>{
 const wh=deferred(),{vm}=panel('cases',async path=>path==='/staff/manage/stocks'?wh.promise:[],{token:'a'})
 vm.loaded=true
 const job=vm.editCase(caseA)
 await vm.refresh()
 wh.resolve({warehouses:[{id:1,name:'主仓',enabled:true}]});await job
 assert.equal(vm.editor?.row?.id,81)
 assert.deepEqual(vm.warehouses.map(x=>x.id),[1])
}))

test('MP-2b 读仓库期间切走再切回售后：旧的读取不再弹出编辑器（审查 P3-1：换模块也要作废预读）',()=>withUni(async()=>{
 const wh=deferred();let n=0
 const {vm}=panel('cases',async path=>path==='/staff/manage/stocks'&&++n===1?wh.promise:path==='/staff/manage/stocks'?stock(1):[],{token:'a'})
 vm.loaded=true;const job=vm.editCase(caseA)
 vm.module='stocks';await vm.reloadModule();vm.module='cases';await vm.reloadModule()
 wh.resolve({warehouses:[{id:1,enabled:true}]});await job
 assert.equal(vm.editor,null);assert.equal(vm.opening,null)
}))

test('MP-3 点“处理售后”后读仓库期间，这个按钮显示“正在打开…”，打开后恢复；再点另一单以后点的为准（审查 P3-2）',()=>withUni(async()=>{
 const first=deferred(),second=deferred();let n=0
 const {vm}=panel('cases',async path=>path==='/staff/manage/stocks'?(++n===1?first.promise:second.promise):[],{token:'a'})
 vm.loaded=true;vm.rows=[caseA,caseC]
 const a=vm.editCase(caseA);assert.equal(vm.opening,81)
 assert.match(await render('../pages/staff/components/StaffManagementPanel.vue',vm),/正在打开…/)
 const c=vm.editCase(caseC);assert.equal(vm.opening,83)
 first.resolve({warehouses:[{id:1,enabled:true}]});await a;assert.equal(vm.opening,83,'先点的那单回来不能清掉后点那单的提示')
 second.resolve({warehouses:[{id:1,enabled:true}]});await c
 assert.equal(vm.opening,null);assert.equal(vm.editor.row.id,83)
}))

test('MP-3b 两分钟内连续处理几单要选仓库的售后：仓库只读一次（审查 P3-2：仓库列表在本模块内缓存）',()=>withUni(async()=>{
 let n=0
 const {vm}=panel('cases',async path=>{if(path==='/staff/manage/stocks'){n++;return {warehouses:[{id:1,enabled:true}]}}return []},{token:'a'})
 vm.loaded=true;await vm.editCase(caseA);vm.closeEditor();await vm.editCase(caseC)
 assert.equal(n,1);assert.equal(vm.editor.row.id,83);assert.deepEqual(vm.warehouses.map(x=>x.id),[1])
}))

test('MP-4 读仓库时换成另一个账号、读取以普通错误失败：不显示错误、不通知父页面（审查 B2：钉住账号比对）',()=>withUni(async()=>{
 const session={token:'a'},wh=deferred()
 const {vm,emitted}=panel('cases',async path=>path==='/staff/manage/stocks'?wh.promise:[],session)
 vm.loaded=true;const job=vm.editCase(caseA);session.token='b'
 wh.reject(Error('仓库读取超时'));await job
 assert.equal(vm.error,'');assert.deepEqual(emitted.filter(e=>e[0]==='access-change'),[]);assert.equal(vm.editor,null);assert.equal(vm.opening,null)
}))

for(const where of ['read','submit'])test('MP-5 '+where+'：登录已被清掉、报错却是普通文案（网络异常），也通知父页面回到登录（审查 B3）',()=>withUni(async()=>{
 const session={token:'a'}
 const {vm,emitted}=panel('withdrawals',async()=>{session.token='';throw Error('网络异常')},session)
 if(where==='read')await vm.refresh()
 else{vm.loaded=true;vm.editWithdrawal({id:34,member_id:32,realName:'回归推广员',amount:1200,fee:0,tax_amount:0,service_fee:0,review_status:'pending',canApprove:true},'approve');vm.editor.note='收款资料已核对';await vm.submit()}
 assert.equal(emitted.filter(e=>e[0]==='access-change').length,1)
}))

test('MP-6 售后、提现模块切换“待处理/全部”只在本地筛选，不发请求（审查 B5）',()=>withUni(async()=>{
 for(const module of ['cases','withdrawals']){
  const {vm,calls}=panel(module,async()=>[],{token:'a'})
  await vm.refresh();const before=calls.length
  await vm.setPending(false);await vm.setPending(true);await ticks(2)
  assert.equal(calls.length,before,module)
 }
}))

test('MP-7 确认框打开期间换了账号：不提交，通知父页面按新账号重新加载（与 P3-3 同类）',async()=>{
 const session={token:'a'}
 await withUni(async()=>{
  const {vm,emitted,calls}=panel('withdrawals',async()=>({}),session)
  vm.loaded=true;vm.editWithdrawal({id:34,member_id:32,realName:'回归推广员',amount:1200,fee:0,tax_amount:0,service_fee:0,review_status:'pending',canApprove:true},'approve');vm.editor.note='收款资料已核对'
  await vm.submit()
  assert.equal(calls.filter(c=>c.method==='POST').length,0)
  assert.equal(emitted.filter(e=>e[0]==='access-change').length,1)
 },[],{},()=>{session.token='b';return true})
})

test('MP-8 处理售后提交失败（例如所选仓库刚被停用）：当场重读仓库列表，编辑器里的选择跟着更新（复核 N5）',()=>withUni(async()=>{
 let reads=0
 const {vm}=panel('cases',async(path,method)=>{
  if(method==='POST')throw Error('记录不存在')
  if(path==='/staff/manage/stocks'){reads++;return reads===1?{warehouses:[{id:1,name:'主仓',enabled:true},{id:2,name:'二仓',enabled:true}]}:{warehouses:[{id:1,name:'主仓',enabled:true},{id:2,name:'二仓',enabled:false}]}}
  return []
 },{token:'a'})
 vm.loaded=true;await vm.editCase(caseC);vm.editor.warehouseIndex=1;vm.editor.action='reship';vm.editor.carrier='顺丰速运';vm.editor.tracking='SF1';vm.editor.note='补发处理'
 await vm.submit();await ticks()
 assert.equal(vm.formError,'记录不存在');assert.equal(reads,2,'提交失败后当场重读仓库')
 assert.deepEqual(vm.warehouses.map(w=>w.id),[1]);assert.equal(vm.editor.warehouseIndex,0)
}))

// ---------- 分销商（StaffDistributors.vue） ----------
function dist(session,answer,uploadImage=async()=>assert.fail('不该上传')){
 const calls=[]
 const loaded=loadComponent('../pages/staff/components/StaffDistributors.vue',{...management,...distributors,CaseProofs:{},
  request:async(path,method,body)=>{calls.push({path,method:method||'GET'});return answer(path,method,body)},
  getToken:()=>session.token,API_BASE:'http://127.0.0.1:18130',uploadImage},{module:'distributors',me:manager})
 return {...loaded,calls}
}
const detail={member:{memberId:88,nickname:'回归推广员'},profile:{applicationState:'approved',mode:'auto'},fees:{records:[]},actions:{self:false,canRegisterFee:true,canManage:true}}
function opened(vm){vm.detailId=88;vm.detail=JSON.parse(JSON.stringify(detail));vm.view='detail'}
const accessChanges=emitted=>emitted.filter(e=>e[0]==='access-change').length
const disabled='账号已停用，请联系客服'

test('DS-1 分销商列表读取：后端说“账号已停用”（本地登录已被清掉）时通知父页面（审查 P3-3）',()=>withUni(async()=>{
 const session={token:'a'},{vm,emitted}=dist(session,async()=>{session.token='';throw Error(disabled)})
 await vm.loadList(false)
 assert.equal(vm.error,disabled);assert.equal(accessChanges(emitted),1)
}))

test('DS-2 分销商详情读取：登录已被清掉、报错是普通文案，也通知父页面（审查 P3-3）',()=>withUni(async()=>{
 const session={token:'a'},{vm,emitted}=dist(session,async()=>{session.token='';throw Error('网络异常')})
 vm.detailId=88;vm.view='detail';await vm.loadDetail()
 assert.equal(accessChanges(emitted),1)
}))

test('DS-3 分销商提交：后端说“账号已停用”、本地登录已清掉时通知父页面（审查 P3-3）',()=>withUni(async()=>{
 const session={token:'a'},{vm,emitted,calls}=dist(session,async(path,method)=>{if(method==='POST'){session.token='';throw Error(disabled)}return detail})
 opened(vm);vm.openTier();vm.editor.mode='fixed';vm.editor.tier=2
 await vm.submit()
 assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.equal(accessChanges(emitted),1)
}))

function upload(session,uploadImage){const loaded=dist(session,async()=>detail,uploadImage);opened(loaded.vm);loaded.vm.openFee();return loaded}
for(const [name,fail,expected] of [
 ['上传时后端说“账号已停用”（上传不会清本地登录）',async()=>{throw Error(disabled)},1],
 ['上传途中本地登录被清掉、报错是普通文案',async session=>{session.token='';throw Error('图片上传失败，请检查网络后重试')},1],
 ['上传途中换成另一个账号、报错是普通文案（保持原样：不通知、不显示）',async session=>{session.token='b';throw Error('图片上传失败，请检查网络后重试')},0]
])test('DS-4 '+name+'（审查 P3-3）',async()=>{
 let selected;const session={token:'a'}
 await withUni(async()=>{
  const {vm,emitted}=upload(session,()=>fail(session))
  vm.chooseProof();await selected
  assert.equal(accessChanges(emitted),expected)
  assert.equal(vm.busy,false);assert.equal(vm.editor.proofUrl,'')
  if(!expected)assert.equal(vm.formError,'')
 },[],{chooseImage:o=>{selected=o.success({tempFilePaths:['local-upload-fixture.png']})}})
})

test('DS-5 分销商确认框打开期间换了账号：不提交，通知父页面重新加载（与 P3-3 同类）',async()=>{
 const session={token:'a'}
 await withUni(async()=>{
  const {vm,emitted,calls}=dist(session,async()=>detail)
  opened(vm);vm.openTier();vm.editor.mode='fixed';vm.editor.tier=2
  await vm.submit()
  assert.equal(calls.filter(c=>c.method==='POST').length,0);assert.equal(accessChanges(emitted),1)
 },[],{},()=>{session.token='b';return true})
})

// ---------- 图片上传（services/image-upload.js） ----------
test('UP-1 上传被网关或防火墙拒绝（HTTP 403）不说成“登录已过期”；401 仍提示重新登录（审查疑点）',async()=>{
 const source=readFileSync(new URL('../services/image-upload.js',import.meta.url),'utf8').replace(/\/\/ #ifdef H5[\s\S]*?\/\/ #endif\n/,'')
 const {uploadImage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
 const prior=globalThis.uni;let status=403
 globalThis.uni={getImageInfo:o=>o.success({width:100,height:100}),compressImage:o=>o.success({tempFilePath:'small.jpg'}),getFileInfo:o=>o.success({size:1000}),uploadFile:o=>o.success({statusCode:status,data:''})}
 try{
  await assert.rejects(uploadImage({path:'a.jpg',url:'u',token:'t'}),e=>/上传被拒绝/.test(e.message)&&!/登录/.test(e.message))
  status=401
  await assert.rejects(uploadImage({path:'a.jpg',url:'u',token:'t'}),/登录已过期/)
 }finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
})

// ---------- 提现规则（services/withdrawal-guidance.js） ----------
const ruleText=(distribution,rules={withdrawWorkingDays:3})=>Object.fromEntries(withdrawalRuleRows(distribution,rules).map(r=>[r.key,r.text]))
test('RL-1 每日限额写明是“每人每日到账限额”并显示金额；已审核的转账也可能顺延；不再有推广员没法自己判断的“单笔超过每日限额请联系商家”（审查 A1–A3）',()=>{
 const rows=ruleText({withdrawalMaxAmount:20000,withdrawalDailyLimit:200000})
 assert.match(rows.count,/每人每日到账限额（¥2000\.00）/)
 assert.match(rows.count,/额度允许后.*审核/);assert.match(rows.count,/已审核的转账也可能顺延/)
 assert.doesNotMatch(rows.count,/每日额度|单笔到账金额超过|次日|明天|第二天/)
})
test('RL-2 旧后端还没下发每日限额：照样说明是每人每日到账限额，但不编金额',()=>{
 const rows=ruleText({withdrawalMaxAmount:20000})
 assert.match(rows.count,/每人每日到账限额/);assert.doesNotMatch(rows.count,/¥|NaN|undefined/)
})
test('RL-3 服务器关闭了本地每日限额（0）：不提商家每日限额，只说受微信额度限制',()=>{
 const rows=ruleText({withdrawalMaxAmount:20000,withdrawalDailyLimit:0})
 assert.doesNotMatch(rows.count,/每日到账限额|额度允许后/);assert.match(rows.count,/微信额度/)
})
test('RL-4 审核时限：工作日按周一至周五算，遇法定节假日顺延（审查 A4）',()=>{
 const rows=ruleText({withdrawalMaxAmount:20000},{withdrawWorkingDays:3})
 assert.match(rows.review,/3 个工作日/);assert.match(rows.review,/法定节假日顺延/)
})
