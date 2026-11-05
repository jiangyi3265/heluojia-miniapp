import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// Real component methods/reactivity; session, network and native UI are local stand-ins.
const w=await loadHelpers('../services/staff-workbench.js')
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const {formatDate}=await loadHelpers('../services/display.js')
const role={bound:true,canViewOrders:true,canShip:true,canCollectPickup:true,canViewProducts:true,canEditProducts:true,canViewStock:true,canViewCases:true,canHandleCases:true}
const order={id:73,orderNo:'LOCAL-73',status:'paid',deliveryMethod:'express',shippable:true,items:[]}
const pickup={...order,id:74,deliveryMethod:'pickup',pickupStatus:'ready',collectable:true}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
async function withUni(run){const prior=globalThis.uni;globalThis.uni=fakeUni();try{return await run()}finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}}
function bench(session,request=async p=>p==='/staff/me'?role:p==='/staff/overview'?{}:{rows:[],total:0}){
 const loaded=loadComponent('../pages/staff/components/StaffWorkbench.vue',{...w,UiIcon:{},StaffModeSwitch:{},StaffManagementPanel:{},StaffDashboard:{},StaffDistributors:{},StaffSettings:{},StaffLookup:{},StaffCustomers:{},managementModules:management.managementModules,menuDense:management.menuDense,request,getToken:()=>session.token,notify(){},asset:x=>x,formatDate,switchToCustomerView(){}})
 loaded.vm.applyMe({...role});return loaded
}
function privateState(vm,kind='ship'){
 vm.rows=[{...order,recipient:{phone:'13800000000'}}];vm.total=1;vm.overview={privateAmount:12345};vm.overviewError='old';vm.listError='old'
 if(kind==='ship'){vm.openShip(order);vm.shipSheet.carrier='顺丰';vm.shipSheet.tracking='SF12345678'}else vm.openPickup(pickup)
}
function cleared(vm){assert.equal(vm.state,'login');assert.equal(vm.me,null);assert.equal(vm.shipSheet,null);assert.equal(vm.pickupSheet,null);assert.deepEqual(vm.rows,[]);assert.equal(vm.total,0);assert.equal(vm.overview,null);assert.equal(vm.listError,'');assert.equal(vm.overviewError,'')}
for(const kind of ['ship','pickup'])for(const loss of ['missing','expired'])test(kind+'身份'+loss+'刷新必须清除遮挡登录的私有表单和订单',()=>withUni(async()=>{
 const session={token:'old'}, {vm}=bench(session,async()=>{session.token='';throw Error('登录已过期，请重新登录')})
 privateState(vm,kind);if(loss==='missing')session.token='';await vm.refresh();cleared(vm)
}))
test('发货请求在途失效清除弹层但保留写锁直至原请求结束',()=>withUni(async()=>{
 const pending=deferred(),session={token:'old'},{vm}=bench(session,async(p,m)=>m==='POST'?pending.promise:role)
 privateState(vm);const job=vm.submitShip();await settle();session.token='';await vm.refresh()
 const snapshot={sheet:vm.shipSheet,busy:vm.busy,state:vm.state};pending.reject(Error('请先登录'));await job
 assert.equal(snapshot.sheet,null);assert.equal(snapshot.busy,true);assert.equal(snapshot.state,'login');assert.equal(vm.busy,false)
}))
test('同身份有效刷新保留合法发货草稿和原写锁',()=>withUni(async()=>{
 const session={token:'same'},{vm}=bench(session);privateState(vm);const sheet=vm.shipSheet;vm.busy=true;await vm.refresh()
 assert.equal(vm.shipSheet,sheet);assert.equal(vm.shipSheet.tracking,'SF12345678');assert.equal(vm.busy,true)
}))
for(const stale of [false,true])test('旧刷新失效不得清除新账号 '+(stale?'staleSession':'generation'),()=>withUni(async()=>{
 const session={token:'old'},pending=deferred();let calls=0
 const {vm}=bench(session,async p=>p==='/staff/me'?(++calls===1?pending.promise:role):p==='/staff/overview'?{}:{rows:[],total:0})
 const old=vm.refresh();session.token='new';if(!stale)await vm.refresh();privateState(vm);const sheet=vm.shipSheet
 pending.reject(Object.assign(Error('请先登录'),{staleSession:stale}));await old
 assert.equal(vm.state,'ok');assert.equal(vm.shipSheet,sheet);assert.equal(vm.rows.length,1);assert.equal(vm.loadError,'')
}))
function panel(session,request){return loadComponent('../pages/staff/components/StaffManagementPanel.vue',{...management,CaseProofs:{},request,getToken:()=>session.token,asset:x=>x,yuan:w.yuan,formatDate,caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:String},{module:'cases',me:role})}
const a={id:81,type:'exchange',status:'returned',items_json:'[]',order_no:'A'},b={id:82,type:'refund',status:'pending',items_json:'[]',order_no:'B'}
test('售后A慢预读不能覆盖后来打开的B',()=>withUni(async()=>{
 const d=deferred(),{vm}=panel({token:'same'},()=>d.promise),slow=vm.editCase(a);await vm.editCase(b);d.resolve({warehouses:[{id:1,enabled:true}]});await slow;assert.equal(vm.editor.row.id,82)
}))
test('售后A迟到普通错误不污染B表单',()=>withUni(async()=>{
 const d=deferred(),{vm}=panel({token:'same'},()=>d.promise),slow=vm.editCase(a);await vm.editCase(b);d.reject(Error('仓库读取超时'));await slow;assert.equal(vm.editor.row.id,82);assert.equal(vm.error,'');assert.equal(vm.formError,'')
}))
test('较早售后预读当前真实登录失效仍通知父级',()=>withUni(async()=>{
 const session={token:'same'},d=deferred(),{vm,emitted}=panel(session,()=>d.promise),slow=vm.editCase(a);await vm.editCase(b);session.token='';d.reject(Error('请先登录'));await slow
 assert.equal(emitted.filter(x=>x[0]==='access-change').length,1)
}))
test('关闭售后编辑器后迟到预读不能重新弹开',()=>withUni(async()=>{
 const d=deferred(),{vm}=panel({token:'same'},()=>d.promise),slow=vm.editCase(a);await vm.editCase(b);vm.closeEditor();d.resolve({warehouses:[]});await slow;assert.equal(vm.editor,null)
}))
test('仍是最新意图的售后预读正常打开且只显示可用仓库',()=>withUni(async()=>{
 const {vm}=panel({token:'same'},async()=>({warehouses:[{id:1,enabled:true},{id:2,enabled:false}]}));await vm.editCase(a);assert.equal(vm.editor.row.id,81);assert.deepEqual(vm.warehouses.map(x=>x.id),[1])
}))
test('旧账号售后预读结果不覆盖新账号表单',()=>withUni(async()=>{
 const session={token:'old'},d=deferred(),{vm}=panel(session,()=>d.promise),slow=vm.editCase(a);session.token='new';await vm.editCase(b);d.resolve({warehouses:[{id:1,enabled:true}]});await slow;assert.equal(vm.editor.row.id,82)
}))
for(const kind of ['ship','prepare'])for(const changed of [true,false])test(kind+'确认等待后'+(changed?'新账号不得承接旧订单':'同账号仍可正常提交'),()=>withUni(async()=>{
 const session={token:'old'},posts=[];let modal
 globalThis.uni=fakeUni([],true,{showModal:o=>{modal=o}})
 const {vm}=bench(session,async(p,m,data)=>{if(m==='POST'){posts.push({p,data,token:session.token});return{}}return p==='/staff/me'?role:p==='/staff/overview'?{}:{rows:[],total:0}})
 privateState(vm);const job=kind==='ship'?vm.submitShip():vm.prepare(pickup);await settle();assert.ok(modal)
 if(changed)session.token='new';else await vm.refresh()
 modal.success({confirm:true});await job
 assert.equal(posts.length,changed?0:1);if(!changed){assert.equal(posts[0].token,'old');assert.equal(posts[0].p,'/staff/orders/'+(kind==='ship'?73:74)+'/'+kind)}assert.equal(vm.busy,false)
}))
for(const kind of ['ship','prepare','pickup'])test(kind+'成功后的迟延刷新仍持锁，结束后下一笔才可开始且保留自身锁',()=>withUni(async()=>{
 const refresh=deferred(),secondWrite=deferred(),session={token:'same'},posts=[];let reads=0
 const {vm}=bench(session,async(p,m)=>{
  if(m==='POST'){posts.push(p);return posts.length===1?{}:secondWrite.promise}
  // 写入后的锁只等订单列表（复核第 14 批 P3-1：经营数据慢不再挡住下一单），所以“迟延的刷新”放在订单列表上
  if(p==='/staff/overview')return {}
  return ++reads===1?refresh.promise:{rows:[],total:0}
 })
 const start=id=>{
  const row={...order,id,orderNo:'LOCAL-'+id}
  if(kind==='prepare')return vm.prepare(row)
  if(kind==='ship'){vm.openShip(row);if(vm.shipSheet){vm.shipSheet.carrier='顺丰';vm.shipSheet.tracking='SF'+id+'123456'};return vm.submitShip()}
  vm.openPickup(row);if(vm.pickupSheet)vm.pickupSheet.code='12345678';return vm.submitPickup()
 }
 const first=start(91);await settle();const whileRefresh={busy:!!vm.busy,posts:posts.length}
 // Do not await a wrongly allowed write before releasing its controlled promise.
 const attempt=start(92);await settle();const afterAttempt={busy:!!vm.busy,posts:posts.length}
 refresh.resolve({});await first;secondWrite.resolve({});await attempt
 assert.deepEqual(whileRefresh,{busy:true,posts:1});assert.deepEqual(afterAttempt,{busy:true,posts:1})
 assert.equal(vm.busy,false)
 const next=deferred();secondWrite.promise=next.promise
 const second=start(92);await settle();assert.equal(posts.length,2);assert.ok(vm.busy)
 next.resolve({});await second;assert.equal(vm.busy,false)
}))
