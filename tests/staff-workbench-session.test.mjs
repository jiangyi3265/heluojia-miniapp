import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// Runs the real StaffWorkbench.vue script (data + computed + methods) against a stand-in for services/shop.js request():
// like the real one, a "请先登录/登录已过期" answer clears the saved login first and then rejects with the server's words.
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(read(path)).toString('base64'))
const helpers=await load('../services/staff-workbench.js')
const {managementModules,menuDense}=await load('../pages/staff/services/staff-management.js')
const {formatDate}=await load('../services/display.js')
const script=read('../pages/staff/components/StaffWorkbench.vue').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .+$/gm,'').replace('export default','return')

const toasts=[]
const scrolls=[],measurements=[]
globalThis.uni={showToast(o){toasts.push(o.title)},showModal({success}){success({confirm:true})},pageScrollTo(o){scrolls.push(o)},getStorageSync(){return ''},setStorageSync(){},createSelectorQuery(){return {in(){return this},select(){return this},boundingClientRect(){return this},selectViewport(){return this},scrollOffset(){return this},exec(fn){measurements.push(fn)}}}}

const shipper={bound:true,name:'小周',roleLabel:'客服',canViewOrders:true,canShip:true,canCollectPickup:true,canViewMoney:false}
const order={id:5,orderNo:'NO5',status:'paid',statusLabel:'待发货',deliveryMethod:'express',items:[],shippable:true}
const pickupOrder={...order,id:6,orderNo:'NO6',deliveryMethod:'pickup'}

// fail(path,session) may throw to simulate a failure; by default the server answers normally.
function bench(fail=()=>{},me=shipper){
 const session={token:'staff-token',expire:false}
 const request=async(path,method)=>{
  if(session.expire||!session.token){session.token='';throw Object.assign(Error('登录已过期，请重新登录'),{uncertain:false})}
  fail(path,session,method)
  if(path==='/staff/me')return me
  if(path==='/staff/overview')return {pendingShipment:1}
  if(path.startsWith('/staff/orders?'))return {rows:[order,pickupOrder],total:2}
  return {}
 }
 const deps={...helpers,UiIcon:{},StaffModeSwitch:{},StaffManagementPanel:{},StaffDashboard:{},StaffDistributors:{},StaffSettings:{},StaffLookup:{},StaffCustomers:{},managementModules,menuDense,request,getToken:()=>session.token,notify(){},asset:x=>x,formatDate,switchToCustomerView(){}}
 const component=Function(...Object.keys(deps),script)(...Object.values(deps))
 const vm={...component.data(),$refs:{},$nextTick:fn=>fn()}
 for(const [name,get] of Object.entries(component.computed))Object.defineProperty(vm,name,{get:get.bind(vm)})
 for(const [name,method] of Object.entries(component.methods))vm[name]=method.bind(vm)
 return {vm,session}
}
// selectView() starts loading without returning the promise; let queued work finish before checking.
const settle=()=>new Promise(resolve=>setImmediate(resolve))
async function opened(fail){const b=bench(fail);await b.vm.refresh();assert.equal(b.vm.state,'ok');assert.equal(b.vm.rows.length,2);return b}

test('使用中登录失效后切换订单页签：进入“请先登录”，不留空白列表',async()=>{
 const {vm,session}=await opened()
 session.expire=true
 vm.selectView('all');await settle()
 assert.equal(vm.state,'login')
 assert.equal(vm.me,null);assert.deepEqual(vm.rows,[]);assert.equal(vm.listError,'');assert.equal(vm.listLoaded,false)
})

test('登录已被清掉后再点页签（请求不带登录），也进入“请先登录”而不是只显示报错',async()=>{
 const {vm,session}=await opened()
 session.token=''
 vm.selectView('aftersale');await settle()
 assert.equal(vm.state,'login');assert.equal(vm.listError,'')
})

test('加载更多、刷新经营数据时登录失效，同样进入“请先登录”',async()=>{
 const a=await opened()
 a.session.expire=true
 await a.vm.loadList(true)
 assert.equal(a.vm.state,'login')
 const b=await opened()
 b.session.expire=true
 await b.vm.loadOverview()
 assert.equal(b.vm.state,'login');assert.equal(b.vm.overview,null);assert.equal(b.vm.overviewError,'')
})

test('发货时登录失效：关闭发货单并进入“请先登录”',async()=>{
 const {vm,session}=await opened()
 vm.openShip(order);vm.shipSheet.carrier='顺丰速运';vm.shipSheet.tracking='SF1234567890'
 session.expire=true
 await vm.submitShip()
 assert.equal(vm.state,'login');assert.equal(vm.shipSheet,null);assert.equal(vm.busy,false)
})

test('备货、核销自提时登录失效：进入“请先登录”',async()=>{
 const a=await opened()
 a.session.expire=true
 await a.vm.prepare(pickupOrder)
 assert.equal(a.vm.state,'login');assert.equal(a.vm.busy,false)
 const b=await opened()
 b.vm.openPickup(pickupOrder);b.vm.pickupSheet.code='12345678'
 b.session.expire=true
 await b.vm.submitPickup()
 assert.equal(b.vm.state,'login');assert.equal(b.vm.pickupSheet,null)
})

test('岗位权限被调整时查询身份又发现登录失效：进入“请先登录”',async()=>{
 const {vm,session}=await opened((path,session)=>{if(path.startsWith('/staff/orders?view=all')){session.expire=true;throw Error('当前岗位无权查看订单')}})
 vm.selectView('all');await settle()
 assert.equal(vm.state,'login');assert.equal(vm.listError,'')
})

test('仍然登录时网络失败照旧提示重试，不会被当成登录失效',async()=>{
 const {vm}=await opened(path=>{if(path.startsWith('/staff/orders?view=all'))throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})})
 vm.selectView('all');await settle()
 assert.equal(vm.state,'ok');assert.equal(vm.listError,'订单暂时没有加载出来：无法连接服务，请检查网络后重试')
})

test('换了另一个账号登录后，旧请求的失败不会把页面切到“请先登录”',async()=>{
 const {vm}=await opened((path,session)=>{if(path.startsWith('/staff/orders?view=all')){session.token='another-staff';throw Object.assign(Error('登录状态已变更，请刷新后重试'),{staleSession:true})}})
 vm.selectView('all');await settle()
 assert.equal(vm.state,'ok');assert.equal(vm.listError,'')
})

test('dashboard to-do opens the requested order tab',async()=>{
 const warehouse={bound:true,name:'小仓',roleLabel:'仓库',canViewOrders:true,canShip:true,canCollectPickup:true,canViewProducts:true,canViewStock:true}
 const a=bench(()=>{},warehouse);await a.vm.refresh()
 assert.equal(a.vm.activeModule,'orders');assert.equal(a.vm.view,'shipping')
 await a.vm.openModule({module:'orders',view:'pickup'})
 assert.equal(a.vm.activeModule,'orders');assert.equal(a.vm.view,'pickup')
 const onlyShip={bound:true,name:'小周',roleLabel:'发货',canViewOrders:true,canShip:true}
 const b=bench(()=>{},onlyShip);await b.vm.refresh()
 assert.equal(b.vm.view,'shipping')
 await b.vm.openModule({module:'orders',view:'pickup'})
 assert.equal(b.vm.activeModule,'orders');assert.equal(b.vm.view,'shipping')
})

test('modules the person lacks are refused with a toast',async()=>{
 const {vm}=bench();await vm.refresh()
 toasts.length=0
 await vm.openModule({module:'dashboard'})
 assert.equal(vm.activeModule,'orders');assert.deepEqual(toasts,['这类事项由有相应权限的同事处理'])
 vm.moduleBusy=true;toasts.length=0
 await vm.openModule({module:'orders',view:'all'})
 assert.deepEqual(toasts,[]);assert.notEqual(vm.view,'all')
})

test('bottom of page pages the active module',async()=>{
 const owner={...shipper,canViewDistributors:true,canViewDashboard:true,canViewMoney:true,canViewCases:true,canReviewWithdrawals:true,canViewCustomers:true,canViewProducts:true,canViewStock:true}
 const {vm}=bench(()=>{},owner);await vm.refresh()
 assert.equal(vm.dense,true);assert.equal(vm.modules.length,9)
 let hit=false
 vm.activeModule='distributors';vm.$refs.management={loadMore(){hit=true}}
 vm.loadMore();assert.equal(hit,true)
 vm.activeModule='cash';vm.$refs.management={refresh(){}}
 assert.doesNotThrow(()=>vm.loadMore())
 vm.$refs.management=undefined;assert.doesNotThrow(()=>vm.loadMore())
})

test('opening withdrawal review brings its content into view; stale measurements cannot move another module',async()=>{
 const {vm}=bench(()=>{},{...shipper,canReviewWithdrawals:true,canViewProducts:true});await vm.refresh()
 scrolls.length=0;measurements.length=0
 await vm.chooseModule('withdrawals')
 assert.equal(vm.activeModule,'withdrawals')
 assert.equal(vm.menuOpen,false,'the menu must not cover the selected module')
 await vm.chooseModule('products')
 measurements[0]([{top:600},{scrollTop:0}])
 assert.equal(scrolls.length,0)
 measurements[1]([{top:600},{scrollTop:0}])
 assert.equal(scrolls.length,1)
 assert(scrolls[0].scrollTop>0,'show the selected content instead of jumping back to the menu')
 vm.showModuleMenu()
 assert.equal(vm.menuOpen,true)
 assert.equal(scrolls.at(-1).scrollTop,0)
})

test('a pending business submission keeps the module and scroll position locked',async()=>{
 const {vm}=bench(()=>{},{...shipper,canReviewWithdrawals:true});await vm.refresh()
 scrolls.length=0;measurements.length=0;vm.moduleBusy=true
 await vm.chooseModule('withdrawals')
 assert.equal(vm.activeModule,'orders');assert.equal(measurements.length,0);assert.equal(scrolls.length,0)
 assert.equal(vm.menuOpen,true)
 vm.menuOpen=false;vm.showModuleMenu();assert.equal(vm.menuOpen,false)
})
