import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// 2026-09-28 手机管理端点测发现的问题：每条都按员工在手机上看到的内容核对。
const require=createRequire(import.meta.url)
const {createSSRApp}=require('vue'),{renderToString}=require('vue/server-renderer')
const w=await loadHelpers('../services/staff-workbench.js')
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const lookup=await loadHelpers('../pages/staff/services/staff-lookup.js')
const {formatDate}=await loadHelpers('../services/display.js')
const {paymentModeText,paymentPartsText,refundPartsText}=await loadHelpers('../services/order-display.js')
// 组件里打开表单会滚动页面：整个文件用一个假的 uni，只有确认框按需替换
const baseUni=fakeUni();globalThis.uni=baseUni

// 测试环境里 5 个岗位 /shop/app/staff/me 实际返回的能力（见 ENV.md 2.1）
const ALL=['canViewOrders','canShip','canCollectPickup','canViewMoney','canViewProducts','canEditProducts','canViewStock','canAdjustStock','canViewCustomers','canReviewCustomers','canViewCases','canHandleCases','canReviewWithdrawals','canViewDashboard','canViewDistributors','canRegisterPartnerFees','canManageDistributors','canViewShopSettings','canEditShopSettings','canLookupCustomers','canViewCustomerArchive','canTopUpCustomers','canVoidTopUps']
const role=(name,keys)=>Object.fromEntries([['bound',true],['name',name],...ALL.map(k=>[k,keys.includes(k)])])
const ROLES={
 manager:role('赵店长',ALL),
 finance:role('钱财务',['canViewOrders','canViewMoney','canViewStock','canViewCases','canHandleCases','canReviewWithdrawals','canViewDashboard','canViewDistributors','canRegisterPartnerFees','canViewShopSettings','canLookupCustomers','canViewCustomerArchive','canTopUpCustomers']),
 customer:role('孙客服',['canViewOrders','canShip','canViewCustomers','canReviewCustomers','canViewCases','canLookupCustomers','canViewCustomerArchive']),
 warehouse:role('李仓管',['canViewOrders','canShip','canCollectPickup','canViewProducts','canViewStock','canAdjustStock']),
 shipping:role('周发货',['canViewOrders','canShip'])
}

// 渲染组件模板（小程序标签当作普通标签），拿到员工实际看到的文字
async function render(rel,vm){
 const template=readFileSync(new URL(rel,import.meta.url),'utf8').match(/<template>([\s\S]*)<\/template>\s*<script>/)[1]
 const app=createSSRApp({template,setup:()=>vm,components:{CaseProofs:{props:['heading','count'],template:'<i>{{heading||"已上传的图片凭证"}}</i>'}}})
 app.config.compilerOptions.isCustomElement=tag=>['view','text','image','input','textarea','picker','switch','scroll-view'].includes(tag)
 app.config.warnHandler=()=>{}
 return (await renderToString(app)).replace(/<!--[\s\S]*?-->/g,'')
}

test('仓库、发货、客服看不到今天和本月销售额；店长、财务照常看到（店主定）',()=>{
 const overview={today:{orders:19,sales:495496},month:{orders:19,sales:495496},pendingShipment:1,pendingPickup:1,afterSalesOpen:2}
 for(const key of ['warehouse','shipping','customer'])assert.deepEqual(w.overviewCards(overview,ROLES[key]).sales,[],key)
 for(const key of ['manager','finance'])assert.deepEqual(w.overviewCards(overview,ROLES[key]).sales.map(c=>c.sales),['¥4,954.96','¥4,954.96'],key)
 assert.equal(w.overviewCards(overview,ROLES.warehouse).todo.length,3,'the to-do counts stay')
 const source=readFileSync(new URL('../pages/staff/components/StaffWorkbench.vue',import.meta.url),'utf8')
 assert.match(source,/<view v-if="cards\.sales\.length" class="sales-cards">/)
 assert.match(source,/<text v-if="cards\.sales\.length" class="figure-note">按顾客付款统计（未扣退款）/)
})

test('顶部一句话能力说明和下面的功能菜单一致',()=>{
 assert.equal(w.abilityText(ROLES.manager),'可以使用下面全部功能')
 // 第 15 批（店主 10-04）：客户档案店长、客服、财务能看；门店充值由店长或财务登记
 assert.equal(w.abilityText(ROLES.finance),'可以查看订单、查看收款、查客户订单、给客户充值、处理售后、查看库存、审核提现、查看经营数据、登记加盟款、查看经营设置')
 assert.equal(w.abilityText(ROLES.customer),'可以查看订单、发货、查客户订单、查看客户档案、查看售后、审核客户')
 assert.equal(w.abilityText(ROLES.warehouse),'可以查看订单、发货、核销自提、查看商品、调整库存')
 assert.equal(w.abilityText(ROLES.shipping),'可以查看订单、发货')
 // 菜单里的每个模块在说明里都有对应的一项
 const words={orders:'查看订单',lookup:'查客户订单',customers:'客户档案|给客户充值',cases:'售后',members:'客户',products:'商品',stocks:'库存',withdrawals:'审核提现',cash:'查看收款',dashboard:'查看经营数据',distributors:'分销商|加盟款',settings:'经营设置'}
 for(const [key,me] of Object.entries(ROLES)){
  const text=w.abilityText(me);if(text==='可以使用下面全部功能')continue
  for(const m of management.managementModules(me))assert.match(text,new RegExp(words[m.key]),key+' '+m.title)
 }
})

test('只读岗位的模块说明写“只能查看”，搜索提示按模块写',()=>{
 const info=key=>management.MANAGEMENT_MODULES.find(m=>m.key===key)
 assert.equal(management.moduleHint(info('products'),ROLES.warehouse),'只能查看商品，改价和上下架由有权限的同事完成')
 assert.equal(management.moduleHint(info('products'),ROLES.manager),'改价、编辑与上下架')
 assert.equal(management.moduleHint(info('stocks'),ROLES.finance),'只能查看库存和流水，调整由有权限的同事完成')
 assert.equal(management.moduleHint(info('cases'),ROLES.customer),'只能查看售后进度，处理由有权限的同事完成')
 assert.equal(management.moduleHint(info('cash'),ROLES.finance),'实收、退款与净收')
 assert.doesNotMatch(info('products').search,/订单号/);assert.match(info('stocks').search,/订单号/)
})

test('改价、上下架、增减库存的确认框写明商品和改动',()=>{
 const row={name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:8800,enabled:true,detail:'说明'}
 assert.equal(management.productConfirm(row,{name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:9990,enabled:true,detail:'说明'}),'确认把「赫洛嘉舒缓修护面膜 5片/盒」零售价 ¥88.00 → ¥99.90？')
 assert.equal(management.productConfirm(row,{name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:8800,enabled:false,detail:'说明'}),'确认把「赫洛嘉舒缓修护面膜 5片/盒」下架？')
 assert.equal(management.productConfirm({...row,enabled:0},{name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:128800,enabled:true,detail:'新说明'}),'确认把「赫洛嘉舒缓修护面膜 5片/盒」零售价 ¥88.00 → ¥1,288.00，上架，修改商品说明？')
 assert.equal(management.productConfirm(row,{...row}),'「赫洛嘉舒缓修护面膜 5片/盒」没有改动，仍然保存？')
 const stock={product_name:'赫洛嘉水润平衡爽肤水',spec:'150ml',warehouse_name:'默认仓库',channel:'C',available:41}
 assert.equal(management.stockConfirm(stock,5),'确认给「赫洛嘉水润平衡爽肤水 150ml」（默认仓库 · 零售）增加 5 件可售库存？现在可售 41 件。')
 assert.equal(management.stockConfirm({...stock,channel:'B'},-3),'确认给「赫洛嘉水润平衡爽肤水 150ml」（默认仓库 · 采购）减少 3 件可售库存？现在可售 41 件。')
})

// 用真实的 StaffManagementPanel 脚本走一遍“填表 → 确认框”
function panel(module,me=ROLES.manager){
 const deps={...management,CaseProofs:{},request:async()=>{throw Error('unexpected request')},getToken:()=>'staff-token',asset:x=>x,yuan:w.yuan,formatDate,caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:x=>String(x)}
 return loadComponent('../pages/staff/components/StaffManagementPanel.vue',deps,{module,me}).vm
}
async function confirmText(vm){
 const shown=[];globalThis.uni=fakeUni([],o=>{shown.push(o);return false})
 try{await vm.submit()}finally{globalThis.uni=baseUni}
 return shown[0]
}

test('确认框写明是哪件商品、改了什么；库存确认写明件数',async()=>{
 const vm=panel('products')
 vm.editProduct({id:6,name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:8800,enabled:true,detail:'',product_code:'P6',version:3})
 vm.editor.price='99.90'
 const modal=await confirmText(vm)
 assert.equal(modal.content,'确认把「赫洛嘉舒缓修护面膜 5片/盒」零售价 ¥88.00 → ¥99.90？')
 const stocks=panel('stocks')
 stocks.editStock({product_id:5,product_name:'赫洛嘉水润平衡爽肤水',spec:'150ml',warehouse_id:1,warehouse_name:'默认仓库',channel:'C',available:41})
 stocks.editor.delta='5';stocks.editor.note='盘点增加'
 assert.equal((await confirmText(stocks)).content,'确认给「赫洛嘉水润平衡爽肤水 150ml」（默认仓库 · 零售）增加 5 件可售库存？现在可售 41 件。')
})

test('改价时带上打开编辑时看到的内容，库存变了也能保存',async()=>{
 const vm=panel('products')
 vm.editProduct({id:6,name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:8800,enabled:1,detail:'说明',version:3})
 vm.editor.price='99.90'
 assert.deepEqual(vm.body(),{version:3,base:{name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:8800,detail:'说明',enabled:true},name:'赫洛嘉舒缓修护面膜',spec:'5片/盒',price:9990,detail:'说明',enabled:true})
})

test('售后卡片和确认框写明顾客；已补发的单不留在“待处理”',async()=>{
 const row={id:1,type:'refund',status:'pending',member_id:10,query_customer:'张先生',order_no:'BC1790576512069157ba7',amount:19976,items_json:'[]',reason:'不想要了'}
 assert.equal(management.caseCustomer(row),'张先生（会员编号 10）')
 assert.equal(management.caseCustomer({...row,query_customer:''}),'顾客（会员编号 10）')
 const vm=panel('cases');vm.rows=[row,{...row,id:5,status:'reshipped',type:'exchange'},{...row,id:6,status:'awaiting_reship',type:'exchange'}];vm.loaded=true
 assert.deepEqual(vm.filtered.map(r=>r.id),[1,6],'reshipped cases wait for the customer, there is nothing to press')
 vm.pendingOnly=false;assert.deepEqual(vm.filtered.map(r=>r.id),[1,5,6])
 const html=await render('../pages/staff/components/StaffManagementPanel.vue',vm)
 assert.match(html,/顾客 张先生（会员编号 10）/)
 await vm.editCase(row);vm.editor.note='核实后同意退款'
 assert.equal(vm.editor.subtitle,'张先生（会员编号 10） · 订单 BC1790576512069157ba7')
 assert.equal((await confirmText(vm)).content,'确定对张先生（会员编号 10）的仅退款执行「通过申请」？ 本次可能发起 ¥199.76 退款。')
})

test('拒绝提现的确认框写明是谁、多少钱',async()=>{
 const row={id:2,member_id:7,realName:'吴晓敏',nickname:'吴老师',phoneTail:'0002',amount:10000,fee:200,tax_amount:1300,service_fee:100,review_status:'pending',transfer_state:'CREATED',canReject:true}
 const vm=panel('withdrawals')
 vm.editWithdrawal(row,'rejected');vm.editor.note='资料不全，请补充后再申请'
 assert.equal((await confirmText(vm)).content,'确认拒绝吴晓敏（会员编号 7，手机尾号 0002）这笔 ¥100.00 的提现，并退回可提现佣金？')
 vm.editWithdrawal({...row,review_status:'approved',transfer_state:'QUEUED'},'rejected');vm.editor.note='顾客要求取消'
 assert.equal((await confirmText(vm)).content,'确认取消吴晓敏（会员编号 7，手机尾号 0002）这笔 ¥100.00 的提现，并退回可提现佣金？')
})

test('结果不确定时只说“已锁定，请返回核对”，不再叫人重试；提示框单独一行',async()=>{
 try{
  const deps={...management,CaseProofs:{},request:async()=>{throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})},getToken:()=>'staff-token',asset:x=>x,yuan:w.yuan,formatDate,caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:x=>String(x)}
  const {vm:members}=loadComponent('../pages/staff/components/StaffManagementPanel.vue',deps,{module:'members',me:ROLES.manager})
  members.loaded=true;members.editMember({id:36,distributor_state:'pending',distributor_data:JSON.stringify({name:'韩雪梅',phone:'13975129901',license:'/x.png'})},'distributor');members.editor.note='资料齐全'
  await members.submit();await settle()
  assert.equal(members.uncertain,true);assert.equal(members.formError,'')
  const html=await render('../pages/staff/components/StaffManagementPanel.vue',members)
  assert.doesNotMatch(html,/请检查网络后重试/);assert.match(html,/上次请求结果未确认，本次内容已锁定。请返回核对最新状态/)
 }finally{globalThis.uni=baseUni}
 assert.match(readFileSync(new URL('../pages/staff/components/StaffManagementPanel.vue',import.meta.url),'utf8'),/\.error\{display:block;/)
})

test('分销申请的附件标题是申请资料，不说成售后凭证',async()=>{
 const vm=panel('members');vm.loaded=true
 vm.rows=[{id:36,nickname:'A组申请人甲',distributor_state:'pending',distributor_data:JSON.stringify({name:'韩雪梅',phone:'13975129901',license:'/shop/app/license/x.png'})}]
 const html=await render('../pages/staff/components/StaffManagementPanel.vue',vm)
 assert.match(html,/>分销核验资料<\/i>/);assert.doesNotMatch(html,/已上传的图片凭证/)
 assert.match(readFileSync(new URL('../components/CaseProofs.vue',import.meta.url),'utf8'),/\{\{heading\|\|'已上传的图片凭证'\}\}/)
})

test('库存流水显示订单号和同事姓名，能按订单号搜到',async()=>{
 const vm=panel('stocks');vm.loaded=true;vm.stockHistory=true
 vm.movements=[{id:1,product_name:'赫洛嘉焕颜修护精华液',warehouse_name:'默认仓库',channel:'C',kind:'ship',quantity:1,reference_key:'order_1',order_no:'BC17905765099332b6ee4',operator_name:'李仓管',created_at:'2026-09-28 15:00:00',note:'发货出库'},
  {id:2,product_name:'赫洛嘉焕颜修护精华液',warehouse_name:'默认仓库',channel:'C',kind:'ship',quantity:1,reference_key:'order_10',order_no:'BC1790576513010e060ba',operator_name:'李仓管',created_at:'2026-09-28 15:00:00',note:'发货出库'}]
 vm.keyword='BC17905765099332b6ee4';assert.deepEqual(vm.filtered.map(r=>r.id),[1])
 const html=await render('../pages/staff/components/StaffManagementPanel.vue',vm)
 assert.match(html,/订单 BC17905765099332b6ee4/);assert.match(html,/李仓管/)
 assert.equal(vm.sourceLabel('wechat_order'),'微信支付')
})

test('自提订单详情只写取货人和门店，不显示顾客家庭住址和“还需发”',async()=>{
 const detail={order:{orderId:5,orderNo:'BC17905765114567890ad',status:'paid',statusLabel:'待备货',businessType:'retail',businessLabel:'零售',createdAt:'2026-09-28 10:00:00',paidAt:'2026-09-28 10:01:00',isTest:false},
  buyer:{memberId:11,nickname:'刘女士',phone:'13975120004'},amounts:{subtotal:16800,discount:2016,pointsDiscount:0,shipping:0,amount:14784,refunded:0,refundedShipping:0},payment:{payment_mode:'wallet',wallet_amount:14784,external_amount:0,refunded_wallet:0,refunded_external:0},
  delivery:{method:'pickup',methodLabel:'门店自提',recipient:{name:'刘静',phone:'13975120004',address:'湖南省株洲市天元区泰山路 88 号 湘江家园 5 栋 302'},addressHidden:false,pickup:{store:{name:'赫洛嘉长沙五一广场店',address:'湖南省长沙市芙蓉区五一大道 188 号 1 楼 108 铺',hours:'每天 10:00-21:00'},status:'pending',statusLabel:'待备货'}},
  items:[{name:'赫洛嘉水润平衡爽肤水',spec:'150ml',quantity:1,price:16800,toShip:1,refundedQuantity:0}],shipments:[],afterSales:[],legacyAfterSaleOpen:false,wechatShipping:null,salesperson:null,timeline:[],timelineNote:'',shippable:false}
 const deps={request:async p=>{if(p==='/staff/manage/lookup/orders/5')return detail;throw Error('unexpected '+p)},getToken:()=>'staff-token',asset:x=>x,formatDate,yuan:w.yuan,pickupStatusText:w.pickupStatusText,shipFormError:w.shipFormError,normalizeTracking:w.normalizeTracking,paymentModeText,paymentPartsText,refundPartsText,...management,...lookup}
 globalThis.uni=fakeUni()
 try{
  const {vm}=loadComponent('../pages/staff/components/StaffLookup.vue',deps,{module:'lookup',me:ROLES.manager})
  vm.openOrder(5);await settle()
  const html=await render('../pages/staff/components/StaffLookup.vue',vm)
  assert.match(html,/门店地址 湖南省长沙市芙蓉区五一大道 188 号 1 楼 108 铺/);assert.match(html,/取货人 刘静/)
  assert.doesNotMatch(html,/泰山路/);assert.doesNotMatch(html,/还需发/)
  vm.stack.at(-1).data={...detail,delivery:{...detail.delivery,method:'express',methodLabel:'快递配送',pickup:null}}
  const express=await render('../pages/staff/components/StaffLookup.vue',vm)
  assert.match(express,/泰山路/);assert.match(express,/还需发 1 件/);assert.doesNotMatch(express,/取货人/)
 }finally{globalThis.uni=baseUni}
})

test('网页版不从 cdn.dcloud.net.cn 预读导航栏阴影图',()=>{
 const app=readFileSync(new URL('../App.vue',import.meta.url),'utf8')
 assert.match(app,/\/\* #ifdef H5 \*\/[\s\S]*html body::after\{animation:none\}[\s\S]*\/\* #endif \*\//)
})

test('发货、核销结果不确定时表单锁住，不能在同一张表单上再点一次',async()=>{
 const order={id:1,orderNo:'BC17905765099332b6ee4',status:'paid',deliveryMethod:'express',items:[],shippable:true,recipient:{name:'王女士',phone:'13975120001',address:'长沙'}}
 const pickup={...order,id:6,orderNo:'BC1790576511737f6658a',deliveryMethod:'pickup',pickupStatus:'ready',collectable:true}
 const posts=[]
 const request=async(path,method)=>{
  if(method==='POST'){posts.push(path);throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})}
  if(path==='/staff/me')return ROLES.warehouse
  if(path==='/staff/overview')return {pendingShipment:1,pendingPickup:1,afterSalesOpen:0}
  if(path.startsWith('/staff/orders?'))return {rows:[order,pickup],total:2}
  return {}
 }
 const stub={}
 const deps={...w,UiIcon:stub,StaffModeSwitch:stub,StaffManagementPanel:stub,StaffDashboard:stub,StaffDistributors:stub,StaffSettings:stub,StaffLookup:stub,StaffCustomers:stub,managementModules:management.managementModules,menuDense:management.menuDense,request,getToken:()=>'staff-token',notify(){},asset:x=>x,formatDate,switchToCustomerView(){}}
 const {vm}=loadComponent('../pages/staff/components/StaffWorkbench.vue',deps)
 await vm.refresh();await settle()
 assert.equal(vm.state,'ok')
 vm.openShip(order);vm.shipSheet.carrier='顺丰速运';vm.shipSheet.tracking='SF1234567890'
 await vm.submitShip();await settle()
 assert.deepEqual(posts,['/staff/orders/1/ship'])
 assert.equal(vm.shipSheet.uncertain,true);assert.match(vm.shipSheet.error,/订单列表已自动刷新/);assert.doesNotMatch(vm.shipSheet.error,/下拉刷新/)
 vm.pickCarrier('中通快递');assert.equal(vm.shipSheet.carrier,'顺丰速运')
 await vm.submitShip();assert.equal(posts.length,1,'the locked sheet never posts again')
 const html=await render('../pages/staff/components/StaffWorkbench.vue',vm)
 assert.match(html,/请先核对订单状态/);assert.match(html,/>关闭</)
 assert.doesNotMatch(html,/销售额|按顾客付款统计/,'a warehouse keeper sees no sales figures');assert.match(html,/待发货/)
 vm.closeSheets();vm.openPickup(pickup);vm.pickupSheet.code='15580406'
 await vm.submitPickup();await settle()
 assert.equal(posts.length,2);assert.equal(vm.pickupSheet.uncertain,true)
 await vm.submitPickup();assert.equal(posts.length,2)
})
