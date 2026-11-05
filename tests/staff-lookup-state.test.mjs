import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const lookup=await loadHelpers('../pages/staff/services/staff-lookup.js')
const {yuan,pickupStatusText,shipFormError,normalizeTracking}=await loadHelpers('../services/staff-workbench.js')
const {paymentModeText,paymentPartsText,refundPartsText}=await loadHelpers('../services/order-display.js')
const {formatDate}=await loadHelpers('../services/display.js')

const memberRow={memberId:1201,nickname:'小林',realName:'林小姐',phone:'13800001234',identities:['分销商'],companyName:'',enabled:true,isTest:false,createdAt:'2026-09-01 10:00:00'}
const orderRow={orderId:5012,orderNo:'BC1727338000000a1b2c3',createdAt:'2026-09-25 10:00:00',paidAt:'2026-09-25 10:01:00',status:'paid',statusLabel:'待发货',amount:21800,refundedAmount:0,deliveryMethod:'express',memberId:1201,buyerNickname:'小林',isTest:false}
const memberDetail=(money=true)=>({member:memberRow,referrer:{memberId:88,name:'王推广（手机尾号 5555）'},orders:{total:1,rows:[{...orderRow,itemsText:'赫洛嘉精华水'}]},...(money?{money:{wallet:{online:{available:12000,reserved:0},legacy:{available:0,reserved:0},refundFrozen:0},points:{available:320,debt:0},commission:{withdrawable:5600,pending:2300,withdrawing:0,withdrawalFrozen:false}}}:{})})
const orderDetail=()=>({order:{orderId:5012,orderNo:'BC1727338000000a1b2c3',status:'paid',statusLabel:'待发货',businessType:'retail',businessLabel:'零售',createdAt:'2026-09-25 10:00:00',paidAt:'2026-09-25 10:01:00',isTest:false},
 buyer:{memberId:1201,nickname:'小林',phone:'13800001234'},amounts:{subtotal:21800,discount:0,pointsDiscount:0,shipping:0,amount:21800,refunded:0,refundedShipping:0},
 payment:{payment_mode:'wechat',wallet_amount:1800,external_amount:20000,refunded_wallet:0,refunded_external:0},
 delivery:{method:'express',methodLabel:'快递配送',recipient:{name:'林小姐',phone:'13800001234',address:'湖南省长沙市岳麓区示例路 8 号'},addressHidden:false,pickup:null},
 items:[],shipments:[],afterSales:[],legacyAfterSaleOpen:false,wechatShipping:null,salesperson:{state:'assigned',label:'王推广'},timeline:[],timelineNote:'',shippable:true})
const manager={bound:true,canLookupCustomers:true,canViewMoney:true,canShip:true,canViewCases:true}
const service={bound:true,canLookupCustomers:true,canViewMoney:false,canShip:true,canViewCases:true}

function mount(server,me=manager){
 const calls=[]
 const request=async(path,method='GET',body)=>{calls.push({path,method,body});return server(path,method,body)}
 const deps={request,getToken:()=>'staff-token',asset:x=>x,formatDate,yuan,pickupStatusText,shipFormError,normalizeTracking,paymentModeText,paymentPartsText,refundPartsText,...management,...lookup}
 return {...loadComponent('../pages/staff/components/StaffLookup.vue',deps,{module:'lookup',me}),calls}
}
function withUni(fn){return async()=>{const toasts=[],modals=[];globalThis.uni=fakeUni(toasts,o=>{modals.push(o);return true});try{await fn(toasts,modals)}finally{delete globalThis.uni}}}
const server=(path)=>{
 if(path.startsWith('/staff/manage/lookup?'))return /q=BC/.test(path)?{kind:'orders',rows:[orderRow],more:false}:{kind:'members',rows:[memberRow],more:false}
 if(path==='/staff/manage/lookup/members/1201')return memberDetail()
 if(path==='/staff/manage/lookup/orders/5012')return orderDetail()
 throw Error('unexpected '+path)
}

test('invalid search never calls the server',withUni(async()=>{
 const {vm,calls}=mount(async p=>server(p))
 vm.q='王';vm.search()
 assert.equal(calls.length,0);assert.equal(vm.searchError,'昵称至少输入2个字')
 vm.q='１３８０００01234';vm.search();await settle()
 assert.equal(calls[0].path,'/staff/manage/lookup?q=13800001234');assert.equal(vm.searchError,'');assert.equal(vm.searchedKind,'phone')
 vm.q='#1201';vm.search();await settle()
 assert.equal(calls[1].path,'/staff/manage/lookup?q=%231201')
}))

test('late search answer cannot replace a newer one',withUni(async()=>{
 const slow=[]
 const {vm}=mount(path=>/q=%E5%B0%8F%E6%9E%97/.test(path)?new Promise(r=>slow.push(r)):Promise.resolve({kind:'orders',rows:[orderRow],more:false}))
 vm.q='小林';vm.search()
 vm.q='BC1727338000';vm.search();await settle()
 slow[0]({kind:'members',rows:[memberRow],more:false});await settle()
 assert.equal(vm.result.kind,'orders');assert.equal(vm.searchedQ,'BC1727338000');assert.equal(vm.orders.length,1);assert.equal(vm.members.length,0)
}))

test('customer → order → back restores the customer without reloading',withUni(async()=>{
 const {vm,calls}=mount(async p=>server(p))
 vm.q='13800001234';vm.search();await settle()
 vm.openMember(1201);await settle()
 assert.equal(vm.top.kind,'member');assert.equal(vm.top.data.member.memberId,1201)
 vm.openOrder(5012);await settle()
 assert.equal(vm.top.kind,'order');assert.equal(vm.top.data.order.orderId,5012)
 const n=calls.length
 vm.back()
 assert.equal(calls.length,n);assert.equal(vm.top.kind,'member');assert.ok(vm.top.data)
 vm.back();assert.equal(vm.top,null);assert.equal(vm.result.kind,'members')
}))

test('money shows only when the server sends it',withUni(async()=>{
 const staff=mount(async p=>p.includes('/members/')?memberDetail(false):server(p),service)
 staff.vm.openMember(1201);await settle()
 assert.equal(staff.vm.showMoney,false)
 const boss=mount(async p=>server(p))
 boss.vm.openMember(1201);await settle()
 assert.equal(boss.vm.showMoney,true);assert.equal(boss.vm.pointsLine,'320');assert.deepEqual(boss.vm.walletRows,[{label:'商城余额',value:12000}])
 const odd=mount(async p=>server(p),{...service,canViewMoney:false})
 odd.vm.openMember(1201);await settle()
 assert.equal(odd.vm.showMoney,false,'money is hidden unless the person may see it')
}))

// Review finding: shop_order.discount already holds the points part; the server now sends 优惠 without it and the phone adds
// nothing on top, so the lines on screen add up to 实付金额.
test('order money lines add up to the amount paid',withUni(async()=>{
 const pointsOrder=()=>({...orderDetail(),amounts:{subtotal:10000,discount:0,pointsDiscount:1000,pointsExchange:false,shipping:0,amount:9000,refunded:0,refundedShipping:0}})
 const {vm}=mount(async p=>p==='/staff/manage/lookup/orders/5012'?pointsOrder():server(p))
 vm.openOrder(5012);await settle()
 assert.deepEqual(vm.amountRows,[{label:'商品金额',value:10000},{label:'运费',value:0},{label:'积分抵扣',value:-1000}])
 assert.equal(vm.amountRows.reduce((n,l)=>n+l.value,0),vm.amounts.amount)
}))

test('ship from detail',withUni(async(toasts,modals)=>{
 let fail=null
 const {vm,calls}=mount(async(p,method)=>{if(method==='POST'){if(fail)throw fail;return {}}return server(p)})
 vm.openOrder(5012);await settle()
 vm.openShip(vm.top.data.order)
 vm.shipSheet.carrier='顺丰速运';vm.shipSheet.tracking='sf1234567890'
 await vm.submitShip();await settle()
 const post=calls.find(c=>c.method==='POST')
 assert.equal(post.path,'/staff/orders/5012/ship');assert.deepEqual(post.body,{carrier:'顺丰速运',tracking:'SF1234567890'})
 assert.equal(modals[0].content,'物流公司：顺丰速运\n运单号：SF1234567890\n确认后顾客会在订单里看到物流信息。')
 assert.equal(vm.shipSheet,null);assert.equal(toasts.at(-1),'已发货');assert.equal(calls.at(-1).path,'/staff/manage/lookup/orders/5012')
 fail=Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})
 vm.openShip(vm.top.data.order);vm.shipSheet.carrier='顺丰速运';vm.shipSheet.tracking='SF1234567890'
 const before=calls.length
 await vm.submitShip();await settle()
 assert.ok(vm.shipSheet);assert.equal(vm.shipSheet.error,'网络不稳定，暂时不能确认是否已发货。订单已重新读取：请关闭这里，看订单是否已经发货，没发的话再重新发货。')
 assert.equal(calls.at(-1).path,'/staff/manage/lookup/orders/5012');assert.equal(calls.length,before+2)
 // 点测发现：结果不确定后同一张表单还能再提交。现在锁住：改不了、点不了，只能关闭后看订单状态
 assert.equal(vm.shipSheet.uncertain,true);vm.pickCarrier('中通快递');assert.equal(vm.shipSheet.carrier,'顺丰速运')
 await vm.submitShip();assert.equal(calls.length,before+2,'the locked sheet never posts again')
 vm.closeShip();assert.equal(vm.shipSheet,null)
 vm.openShip(vm.top.data.order);assert.equal(vm.shipSheet.uncertain,false)
 vm.shipSheet.carrier='顺丰速运';vm.shipSheet.tracking='1';await vm.submitShip()
 assert.equal(vm.shipSheet.error,'运单号太短，请核对后再填')
}))

test('rate limit refusal keeps the previous results',withUni(async()=>{
 let limited=false
 const {vm}=mount(async p=>{if(limited)throw Error('查询太频繁，请稍等一分钟再试');return server(p)})
 vm.q='13800001234';vm.search();await settle()
 const before=vm.result
 limited=true;vm.q='13900005678';vm.search();await settle()
 assert.equal(vm.result,before);assert.equal(vm.error,'查询太频繁，请稍等一分钟再试');assert.equal(vm.searchedQ,'13800001234')
}))

test('after-sale jump and permission refusal',withUni(async()=>{
 const {vm,emitted}=mount(async()=>{throw Error('当前岗位无权查询客户')})
 vm.openCases();assert.deepEqual(emitted[0],['open-module',{module:'cases'}])
 vm.openMember(3);await settle()
 assert.equal(vm.top.error,'当前岗位无权查询客户');assert.ok(emitted.some(e=>e[0]==='access-change'))
}))
