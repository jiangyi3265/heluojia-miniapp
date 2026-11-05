import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/staff-workbench.js',import.meta.url),'utf8')
const w=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

const everything={bound:true,name:'王店长',roleLabel:'店长',canViewOrders:true,canShip:true,canCollectPickup:true,canViewMoney:true}
const finance={bound:true,name:'李会计',roleLabel:'财务',canViewOrders:true,canShip:false,canCollectPickup:false,canViewMoney:true}
const service={bound:true,name:'小周',roleLabel:'客服',canViewOrders:true,canShip:true,canCollectPickup:false,canViewMoney:false}

test('bind codes ignore spaces, dashes, lower case and full-width input',()=>{
 assert.equal(w.normalizeBindCode(' ab2c d3ef '),'AB2CD3EF')
 assert.equal(w.normalizeBindCode('ab2c-d3ef'),'AB2CD3EF')
 assert.equal(w.normalizeBindCode('ＡＢ２Ｃ　Ｄ３ＥＦ'),'AB2CD3EF')
 assert.equal(w.normalizeBindCode(null),'')
})
test('bind code errors are plain and specific',()=>{
 assert.equal(w.bindCodeError('ab2c d3ef'),'')
 assert.equal(w.bindCodeError('  '),'请输入绑定码')
 assert.match(w.bindCodeError('AB2CD3E'),/8位/)
 assert.match(w.bindCodeError('AB2CD3EFG'),/8位/)
 assert.match(w.bindCodeError('AB2C#3EF'),/字母和数字/)
})
test('pickup codes must be eight digits after removing spaces',()=>{
 assert.equal(w.normalizePickupCode(' 1234 5678 '),'12345678')
 assert.equal(w.normalizePickupCode('１２３４５６７８'),'12345678')
 assert.equal(w.pickupCodeError('0012 3456'),'')
 assert.equal(w.pickupCodeError(''),'请输入顾客出示的自提码')
 assert.match(w.pickupCodeError('1234567'),/8位数字/)
 assert.match(w.pickupCodeError('1234567a'),/8位数字/)
})
test('shipping form checks carrier and tracking number before asking to confirm',()=>{
 assert.equal(w.shipFormError({carrier:'顺丰速运',tracking:'sf 1234 5678 90'}),'')
 assert.equal(w.normalizeTracking('sf 1234 5678 90'),'SF1234567890')
 assert.equal(w.shipFormError({carrier:' ',tracking:'SF1234567890'}),'请填写物流公司')
 assert.match(w.shipFormError({carrier:'快'.repeat(81),tracking:'SF1234567890'}),/太长/)
 assert.equal(w.shipFormError({carrier:'中通快递',tracking:''}),'请填写运单号')
 assert.match(w.shipFormError({carrier:'中通快递',tracking:'单号78945'}),/字母、数字/)
 assert.match(w.shipFormError({carrier:'中通快递',tracking:'12345'}),/太短/)
 assert.match(w.shipFormError({carrier:'中通快递',tracking:'1'.repeat(101)}),/太长/)
 assert.equal(w.shipFormError({carrier:'京东快递',tracking:'JD-0001234567'}),'')
})

test('access state comes only from the server answer',()=>{
 assert.equal(w.staffAccess(null),'unbound')
 assert.equal(w.staffAccess({bound:false}),'unbound')
 assert.equal(w.staffAccess({bound:'true',canViewOrders:true}),'unbound')
 assert.equal(w.staffAccess({bound:true,canViewOrders:false}),'no-orders')
 assert.equal(w.staffAccess(everything),'ok')
})
test('capabilities decide which order tabs are shown',()=>{
 const views=me=>w.staffTabs(me).map(t=>t.view)
 assert.deepEqual(views(everything),['shipping','pickup','aftersale','all'])
 assert.deepEqual(w.staffTabs(everything).map(t=>t.label),['待发货','待自提','售后中','全部订单'])
 assert.deepEqual(views(finance),['aftersale','all'])
 assert.deepEqual(views(service),['shipping','aftersale','all'])
 assert.deepEqual(views({...everything,canShip:false}),['pickup','aftersale','all'])
 assert.deepEqual(views({...everything,canViewOrders:false}),[])
 assert.deepEqual(views({bound:false,canViewOrders:true,canShip:true}),[])
})
test('ability line tells staff what their role allows',()=>{
 assert.equal(w.abilityText(everything),'可以查看订单、发货、核销自提、查看收款')
 assert.equal(w.abilityText(finance),'可以查看订单、查看收款')
 assert.equal(w.abilityText({bound:true,canViewOrders:false,canShip:false,canCollectPickup:false,canViewMoney:false}),'')
 assert.equal(w.abilityText({bound:false}),'')
})
test('ship, prepare and collect buttons follow the order flags from the server',()=>{
 const shippable={id:1,status:'paid',deliveryMethod:'express',shippable:true},blocked={...shippable,shippable:false,afterSale:'售后待处理'}
 const pending={id:2,status:'paid',deliveryMethod:'pickup',pickupStatus:'pending',preparable:true,collectable:false}
 const ready={...pending,pickupStatus:'ready',preparable:false,collectable:true}
 assert.equal(w.canShipOrder(shippable,everything,'shipping'),true)
 assert.equal(w.canShipOrder(shippable,everything,'all'),false,'shipping happens from the 待发货 list')
 assert.equal(w.canShipOrder(blocked,everything,'shipping'),false,'open after-sales blocks shipping')
 assert.equal(w.canShipOrder({id:3,status:'paid',deliveryMethod:'express'},everything,'shipping'),false,'no flag, no button')
 assert.equal(w.canShipOrder(shippable,finance,'shipping'),false)
 assert.equal(w.canPrepareOrder(pending,everything,'pickup'),true)
 assert.equal(w.canPrepareOrder(pending,everything,'all'),true)
 assert.equal(w.canPrepareOrder(pending,everything,'aftersale'),false)
 assert.equal(w.canPrepareOrder(ready,everything,'pickup'),false)
 assert.equal(w.canPrepareOrder(pending,service,'pickup'),false)
 assert.equal(w.canCollectOrder(ready,everything,'pickup'),true)
 assert.equal(w.canCollectOrder(ready,everything,'all'),true)
 assert.equal(w.canCollectOrder(pending,everything,'pickup'),false,'goods must be prepared before collection')
 assert.equal(w.canCollectOrder(ready,everything,'aftersale'),false)
 assert.equal(w.canCollectOrder(ready,service,'pickup'),false)
})
test('pickup progress is explained in words',()=>{
 assert.match(w.pickupStatusText({deliveryMethod:'pickup',pickupStatus:'pending'}),/还没备货/)
 assert.match(w.pickupStatusText({deliveryMethod:'pickup',pickupStatus:'ready'}),/自提码/)
 assert.equal(w.pickupStatusText({deliveryMethod:'pickup',pickupStatus:'collected'}),'顾客已取走')
 assert.equal(w.pickupStatusText({deliveryMethod:'express',pickupStatus:'ready'}),'')
})
test('overview cards format fen as yuan and show cash only to people allowed to see money',()=>{
 const overview={today:{orders:3,sales:125800},month:{orders:41,sales:12345678},pendingShipment:5,pendingPickup:2,afterSalesOpen:1,cash:{monthReceived:9000000,monthRefunded:12000,monthNet:8988000}}
 const cards=w.overviewCards(overview,everything)
 assert.deepEqual(cards.sales.map(c=>[c.label,c.orders,c.sales]),[['今天',3,'¥1,258.00'],['本月',41,'¥123,456.78']])
 assert.deepEqual(cards.todo.map(c=>[c.view,c.value]),[['shipping',5],['pickup',2],['aftersale',1]])
 assert.deepEqual(cards.cash.map(c=>c.value),['¥90,000.00','¥120.00','¥89,880.00'])
 assert.deepEqual(w.overviewCards(overview,service).cash,[])
 assert.deepEqual(w.overviewCards({...overview,cash:undefined},everything).cash,[])
 const blank=w.overviewCards(null,everything)
 assert.deepEqual(blank.sales.map(c=>[c.orders,c.sales]),[[0,'¥0.00'],[0,'¥0.00']])
 assert.equal(w.yuan(-12000),'-¥120.00')
})
test('delivery text names the pickup store when there is one',()=>{
 assert.equal(w.deliveryText({deliveryMethod:'express'}),'快递配送')
 assert.equal(w.deliveryText({deliveryMethod:'pickup',pickupStore:{name:'五一广场店',address:'长沙市'}}),'门店自提 · 五一广场店')
 assert.equal(w.deliveryText({deliveryMethod:'pickup',pickupStore:'河西店'}),'门店自提 · 河西店')
 assert.equal(w.deliveryText({deliveryMethod:'pickup'}),'门店自提')
 assert.equal(w.deliveryText({deliveryMethod:'drone'}),'其他配送方式')
 assert.deepEqual(w.pickupStore({pickupStore:{name:' A店 ',address:' 地址 '}}),{name:'A店',address:'地址'})
})
test('every tab has an empty-state explanation',()=>{
 for(const view of ['shipping','pickup','aftersale','all']){const e=w.emptyText(view);assert.ok(e.title&&e.hint)}
})

const home={path:'pages/index/index',query:{},scene:1001}
test('a plain open of home or a bottom tab counts as a home launch',()=>{
 assert.equal(w.isHomeLaunch(home),true)
 assert.equal(w.isHomeLaunch({path:'pages/skincare/index',query:{},scene:1001}),true)
 assert.equal(w.isHomeLaunch({path:'/pages/me/index',query:{},scene:1089}),true)
 assert.equal(w.isHomeLaunch({path:'pages/category/index'}),true)
 assert.equal(w.isHomeLaunch({path:'',query:{}}),true)
 assert.equal(w.isHomeLaunch({path:'pages/index/index',query:{referrer:''}}),true)
})
test('shared links, codes and deep links never count as a home launch',()=>{
 assert.equal(w.isHomeLaunch(null),false)
 assert.equal(w.isHomeLaunch({path:'pages/skincare/index',query:{section:'report'},scene:1001}),false)
 assert.equal(w.isHomeLaunch({path:'pages/skincare/index',query:{referrer:'31'},scene:1007}),false)
 assert.equal(w.isHomeLaunch({path:'pages/product/index',query:{id:'12',channel:'C'}}),false)
 assert.equal(w.isHomeLaunch({path:'pages/index/index',query:{referrer:'31'}}),false)
 assert.equal(w.isHomeLaunch({path:'pages/index/index',query:{scene:'r1.0.C'}}),false)
 assert.equal(w.isHomeLaunch({path:'pages/category/index',query:{category:'精华'}}),false)
 assert.equal(w.isHomeLaunch({path:'pages/distributor-apply/index',query:{}}),false)
 assert.equal(w.isHomeLaunch({path:'pages/order-detail/index',query:{id:'9'}}),false)
 assert.equal(w.isHomeLaunch({path:'pages/staff/index',query:{}}),false)
 for(const scene of [1007,1008,1044,1047,1048,1154])assert.equal(w.isHomeLaunch({...home,scene}),false)
})
test('launch routing opens the workbench only for bound staff on a plain launch without the customer choice',()=>{
 assert.equal(w.shouldOpenWorkbench({launch:home,me:everything}),true)
 assert.equal(w.shouldOpenWorkbench({launch:home,me:{bound:true,canViewOrders:false}}),true)
 assert.equal(w.shouldOpenWorkbench({launch:home,me:{bound:false}}),false)
 assert.equal(w.shouldOpenWorkbench({launch:home,me:null}),false)
 assert.equal(w.shouldOpenWorkbench({launch:home,me:everything,customerView:true}),false)
 assert.equal(w.shouldOpenWorkbench({launch:{path:'pages/product/index',query:{id:'3'}},me:everything}),false)
 assert.equal(w.shouldOpenWorkbench({launch:{...home,query:{referrer:'8'}},me:everything}),false)
 assert.equal(w.shouldOpenWorkbench({launch:{...home,scene:1007},me:everything}),false)
 assert.equal(w.shouldOpenWorkbench(),false)
})
