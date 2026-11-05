import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../pages/staff/services/staff-management.js',import.meta.url),'utf8')
const m=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('management menu only follows explicit server capabilities',()=>{
 assert.deepEqual(m.managementModules({bound:false,canHandleCases:true}),[])
 assert.deepEqual(m.managementModules({bound:true,canViewProducts:true}).map(x=>x.key),['products'])
 assert.deepEqual(m.managementModules({bound:true,canViewOrders:true,canViewCases:true,canViewMoney:true,canReviewWithdrawals:true}).map(x=>x.key),['orders','cases','withdrawals','cash'])
 assert.deepEqual(m.managementModules({bound:true,roleLabel:'超级管理员'}),[])
})
test('price conversion never rounds extra decimals or accepts negative and exponential input',()=>{
 assert.equal(m.yuanToFen('0.01'),1);assert.equal(m.yuanToFen('218.10'),21810);assert.equal(m.yuanToFen('1'),100)
 for(const v of ['0','-1','1e3','1.005','1000000.01','NaN',''])assert.throws(()=>m.yuanToFen(v))
})
test('case actions match the complete review, return, inspection and replacement flow',()=>{
 assert.deepEqual(m.caseActions({status:'pending'}).map(x=>x[0]),['approve','reject'])
 assert.deepEqual(m.caseActions({status:'awaiting_return'}).map(x=>x[0]),['extend','close'])
 assert.deepEqual(m.caseActions({status:'awaiting_refund',wechat_refund_state:'CLOSED'}).map(x=>x[0]),['retry_refund'])
 assert.deepEqual(m.caseActions({status:'awaiting_refund',wechat_refund_state:'PROCESSING'}),[])
 for(const [status,action] of [['awaiting_return','extend'],['returned','received'],['inspecting','inspect'],['awaiting_reship','reship']])assert.equal(m.caseActions({status})[0][0],action)
 for(const status of ['awaiting_refund','refunded','completed','rejected'])assert.deepEqual(m.caseActions({status}),[])
})
test('withdrawal net includes all deductions and success remains server-driven',()=>{
 assert.equal(m.netWithdrawal({amount:10000,fee:200,tax_amount:500,service_fee:300}),9000)
 assert.equal(m.withdrawalStatus({transfer_state:'QUEUED'}),'已审核，等待转账')
 assert.equal(m.withdrawalStatus({transfer_state:'SUCCESS'}),'已到账')
 for(const state of ['TRANSFERING','ACCEPTED','CANCELING','REJECTED'])assert.notEqual(m.withdrawalStatus({transfer_state:state}),'处理中')
 assert.equal(m.withdrawalStatus({status:'paid'}),'已到账')
})

test('stock movement distinguishes outbound quantities from inbound and adjustments',()=>{
 assert.deepEqual(m.stockMovement({kind:'transfer_out',quantity:5}),{label:'调拨出库',quantity:'-5'})
 assert.deepEqual(m.stockMovement({kind:'adjust',quantity:-3}),{label:'库存调整',quantity:'-3'})
 assert.deepEqual(m.stockMovement({kind:'inspect',quantity:2}),{label:'验收入库',quantity:'+2'})
})
test('cash range uses Beijing month and rejects invalid or oversized ranges',()=>{
 assert.deepEqual(m.monthDates(new Date('2026-09-30T17:00:00Z')),['2026-10-01','2026-10-01'])
 assert.equal(m.cashDateError('2026-01-01','2026-12-31'),'')
 for(const [a,b] of [['2026-02-30','2026-03-01'],['2026-02-01','2026-01-01'],['2025-01-01','2026-12-31'],['','']])assert.ok(m.cashDateError(a,b))
})
test('closed WeChat refund is flagged on the case list instead of looking like money is on its way',()=>{
 assert.equal(m.caseLabel({status:'awaiting_refund',wechat_refund_state:'CLOSED'}),'微信退款已关闭，待重新发起')
 assert.equal(m.caseLabel({status:'awaiting_refund',wechat_refund_state:'PROCESSING'}),'退款处理中')
 assert.equal(m.caseLabel({status:'awaiting_refund'}),'退款处理中')
 assert.equal(m.caseLabel({status:'refunded',wechat_refund_state:'CLOSED'}),'已退款')
})
test('applicant is named from the application data, not the default WeChat nickname',()=>{
 const row={id:16,nickname:'新朋友',distributor_data:JSON.stringify({name:' 分销丙 ',phone:'13800001234'}),enterprise_data:JSON.stringify({name:'李采购'})}
 assert.equal(m.memberName(row,'distributor'),'分销丙')
 assert.equal(m.memberName(row,'enterprise'),'李采购')
 assert.equal(m.memberName({...row,enterprise_data:null},'enterprise'),'分销丙')
 assert.equal(m.memberName({id:3,nickname:'新朋友',distributor_data:'坏数据'}),'新朋友')
 assert.equal(m.memberName({id:3}),'商城客户')
 assert.equal(m.memberName(undefined),'商城客户')
})
test('closed promotion rights read the same as on the PC backend',()=>{
 assert.equal(m.applicationState('rejected','distributor'),'未通过/已停用')
 assert.equal(m.applicationState('rejected','enterprise'),'已驳回')
 assert.equal(m.applicationState('approved','distributor'),'已通过')
 assert.equal(m.applicationState(undefined,'distributor'),'未申请')
})
test('stock history shows a customer order instead of a bare member number',()=>{
 assert.equal(m.stockOperator({operator_name:'12',reference_key:'reserve_31'}),'顾客下单（会员编号 12）')
 assert.equal(m.stockOperator({operator_name:'12',reference_key:'other'}),'顾客（会员编号 12）')
 assert.equal(m.stockOperator({operator_name:'顾客下单（会员编号 12）',reference_key:'reserve_31'}),'顾客下单（会员编号 12）')
 for(const who of ['mm_warehouse','系统','mm_warehouse（小程序）'])assert.equal(m.stockOperator({operator_name:who,reference_key:'reserve_1'}),who)
 assert.equal(m.stockOperator({}),'')
})
test('twelve modules keep the agreed order, short titles and icons that have a selected look',()=>{
 assert.deepEqual(m.MANAGEMENT_MODULES.map(x=>x.key),['orders','lookup','customers','cases','members','products','stocks','withdrawals','cash','dashboard','distributors','settings'])
 const icons=['back','bag','building','cart','check','cloud','grid','home','leaf','message','pin','refund','search','settings','share','truck','upload','user','wallet']
 for(const x of m.MANAGEMENT_MODULES){assert.ok(x.title.length<=4,x.title);assert.ok(icons.includes(x.icon),x.icon);assert.ok(x.hint)}
})
test('each role sees exactly its modules',()=>{
 const all=['canViewOrders','canShip','canCollectPickup','canViewMoney','canViewProducts','canEditProducts','canViewStock','canAdjustStock','canViewCustomers','canReviewCustomers','canViewCases','canHandleCases','canReviewWithdrawals','canViewDashboard','canViewDistributors','canRegisterPartnerFees','canManageDistributors','canViewShopSettings','canEditShopSettings','canLookupCustomers','canViewCustomerArchive','canTopUpCustomers','canVoidTopUps']
 assert.equal(all.length,23)
 const me=list=>({bound:true,...Object.fromEntries(list.map(k=>[k,true]))})
 assert.deepEqual(m.managementModules(me(all)).map(x=>x.key),['orders','lookup','customers','cases','members','products','stocks','withdrawals','cash','dashboard','distributors','settings'])
 const finance=['canViewOrders','canViewMoney','canViewStock','canViewCases','canHandleCases','canReviewWithdrawals','canViewDashboard','canViewDistributors','canRegisterPartnerFees','canViewShopSettings','canLookupCustomers','canViewCustomerArchive','canTopUpCustomers']
 assert.deepEqual(m.managementModules(me(finance)).map(x=>x.key),['orders','lookup','customers','cases','stocks','withdrawals','cash','dashboard','distributors','settings'])
 assert.deepEqual(m.managementModules(me(['canViewOrders','canShip','canViewCustomers','canReviewCustomers','canViewCases','canLookupCustomers','canViewCustomerArchive'])).map(x=>x.key),['orders','lookup','customers','cases','members'])
 // 客服只能看客户档案：标题下写“只能查看”，不写他点不到的充值
 assert.equal(m.moduleHint(m.MANAGEMENT_MODULES.find(x=>x.key==='customers'),me(['canViewCustomerArchive'])),'只能查看客户档案，充值由店长或财务登记')
 assert.equal(m.moduleHint(m.MANAGEMENT_MODULES.find(x=>x.key==='customers'),me(['canViewCustomerArchive','canTopUpCustomers'])),'全部客户、门店余额与充值')
 assert.deepEqual(m.managementModules(me(['canViewProducts','canEditProducts','canViewStock'])).map(x=>x.key),['products','stocks'])
 assert.deepEqual(m.managementModules({...me(all),bound:false}),[])
 assert.deepEqual(m.managementModules({bound:true,canViewOrders:true,canViewCases:true,canViewMoney:true,canReviewWithdrawals:true}).map(x=>x.key),['orders','cases','withdrawals','cash'])
 assert.deepEqual(m.managementModules({bound:true,canViewDashboard:'true',canLookupCustomers:1}),[])
})
test('dense menu only above eight buttons',()=>{
 assert.equal(m.menuDense(Array(8).fill({})),false)
 assert.equal(m.menuDense(Array(9).fill({})),true)
 assert.equal(m.menuDense(null),false);assert.equal(m.menuDense({length:12}),false)
})
test('Beijing day and clock',()=>{
 assert.equal(m.beijingToday(new Date('2026-09-30T17:00:00Z')),'2026-10-01')
 assert.equal(m.beijingToday(new Date('2026-09-30T15:59:00Z')),'2026-09-30')
 assert.equal(m.beijingClock(new Date('2026-09-26T06:30:00Z')),'14:30')
 assert.equal(m.beijingClock(new Date('2026-09-26T16:05:00Z')),'00:05')
})
