import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers} from './staff-component-harness.mjs'
const d=await loadHelpers('../pages/staff/services/staff-dashboard.js')

// The reply of GET /staff/manage/dashboard as in ui-spec §4.2 (= api-spec §3.4).
const sample={range:{key:'month',from:'2026-09-01',to:'2026-09-26',days:26,label:'本月（2026-09-01 至 2026-09-26）'},
 sales:{paid:612000,refunded:45200,net:566800,orders:26,average:23538,customers:20},
 cash:{received:2508000,refunded:8800,net:2499200,sources:[{source:'wechat_order',label:'微信支付',received:498000,refunded:8800,net:489200},{source:'recharge',label:'小程序充值',received:30000,refunded:0,net:30000},{source:'partner_fee',label:'加盟款',received:1980000,refunded:0,net:1980000},{source:'bank',label:'对公转账',received:0,refunded:0,net:0}]},
 newCustomers:14,
 products:[{productId:1,name:'赫洛嘉精华水 30ml',quantity:42,paid:935600,refunded:20000,net:915600,orders:40}],
 distributors:[{rank:1,memberId:88,name:'王推广（手机尾号 5555）',orders:8,paid:174400,refunded:0,net:174400,commission:43600}],
 distributorsOther:[{name:'无推广员（商城直接卖出/自己拿货）',orders:9,paid:201000,refunded:0,net:201000}],
 commission:{generated:132000,paidOut:{amount:80000,fees:800,taxes:0,serviceFees:800,received:78400},pendingReview:{count:2,amount:22000}},
 todo:{pendingShipment:3,pendingPickup:1,afterSalesOpen:2,withdrawalsToReview:2,applications:1,wechatShippingFailed:0}}

test('range query and 92-day limit',()=>{
 assert.equal(d.dashboardRangeError('2026-07-01','2026-09-30','2026-09-30'),'')
 assert.equal(d.dashboardRangeError('2026-06-30','2026-09-30','2026-09-30'),'一次最多查看92天，请缩短日期范围')
 assert.equal(d.dashboardRangeError('2019-12-31','2020-01-02','2026-09-30'),'开始日期不能早于2020年1月1日')
 assert.equal(d.dashboardRangeError('2026-09-02','2026-09-01','2026-09-26'),'结束日期不能早于开始日期')
 assert.equal(d.dashboardRangeError('2026-02-30','2026-03-01','2026-09-26'),'请选择开始和结束日期')
 assert.equal(d.dashboardRangeError('','2026-03-01','2026-09-26'),'请选择开始和结束日期')
 assert.equal(d.dashboardRangeError('2026-09-01','2026-09-27','2026-09-26'),'结束日期不能晚于今天')
 assert.equal(d.dashboardRangeError('2019-12-31','2020-01-02','2026-09-26'),'开始日期不能早于2020年1月1日')
 assert.equal(d.rangeQuery('custom','2026-08-01','2026-08-31'),'range=custom&from=2026-08-01&to=2026-08-31')
 assert.equal(d.rangeQuery('today','x','y'),'range=today')
 assert.equal(d.rangeQuery('month'),'range=month')
 assert.equal(d.rangeQuery('whatever'),'range=month')
 assert.equal(d.monthStart('2026-09-26'),'2026-09-01')
 assert.equal(d.periodText({from:'2026-09-26',to:'2026-09-26'}),'2026-09-26')
 assert.equal(d.periodText({from:'2026-09-01',to:'2026-09-26'}),'2026-09-01 至 2026-09-26')
 assert.equal(d.periodText(null),'')
})

test('bars never overflow and zero data shows empty bars',()=>{
 assert.deepEqual(d.barWidths([10,5,0,-3]),['100%','50%','0%','0%'])
 assert.deepEqual(d.barWidths([1000,1]),['100%','2%'])
 assert.deepEqual(d.barWidths([3,1]),['100%','33.3%'])
 assert.deepEqual(d.barWidths([0,0]),['0%','0%'])
 assert.deepEqual(d.barWidths('x'),[])
 assert.deepEqual(d.productBars(null),[])
 const rows=Array.from({length:12},(_,i)=>({productId:i+1,name:'商品'+i,quantity:1,orders:1,net:(12-i)*100}))
 const bars=d.productBars(rows)
 assert.equal(bars.length,10);assert.equal(bars[0].width,'100%');assert.equal(bars[9].width,'25%')
 for(const b of bars)assert.ok(Number.parseFloat(b.width)<=100)
})

test('figures come with their explanation and never invent numbers',()=>{
 assert.deepEqual(d.dashboardFigures(null),[])
 const f=Object.fromEntries(d.dashboardFigures(sample).map(x=>[x.key,x]))
 assert.equal(f.sales.value,'¥5,668.00');assert.equal(f.sales.extra,'付款 ¥6,120.00 · 退款 ¥452.00')
 assert.equal(f.cash.value,'¥25,080.00');assert.equal(f.cash.extra,'退回 ¥88.00 · 净收 ¥24,992.00')
 assert.equal(f.cash.extra2,'其中 微信支付 ¥4,980.00、小程序充值 ¥300.00、加盟款 ¥19,800.00')
 assert.equal(f.newCustomers.value,'14 位');assert.equal(f.orders.value,'26 笔');assert.equal(f.average.value,'¥235.38');assert.equal(f.refunded.value,'¥452.00')
 assert.ok(f.sales.wide&&f.cash.wide&&!f.orders.wide)
 for(const x of Object.values(f))assert.ok(x.note.length>0,x.key)
 assert.equal(d.money(1980000),'¥19,800.00');assert.equal(d.money(-452),'-¥4.52');assert.equal(d.money('x'),'¥0.00')
})

test("rankings use the server's names and net amounts",()=>{
 const r=d.distributorBars([{memberId:88,name:'王推广（手机尾号 5555）',orders:8,net:174400,commission:43600}])[0]
 assert.equal(r.name,'王推广（手机尾号 5555）');assert.equal(r.right,'¥1,744.00');assert.equal(r.sub,'8 单 · 佣金 ¥436.00');assert.equal(r.rank,1)
 const p=d.productBars([{productId:1,name:'赫洛嘉精华水 30ml',quantity:42,net:915600,orders:40}])[0]
 assert.equal(p.right,'¥9,156.00');assert.equal(p.sub,'42 件 · 40 单')
 assert.equal(d.unattributedText([{name:'无推广员（商城直接卖出/自己拿货）',orders:9,net:201000}]),'无推广员（商城直接卖出/自己拿货） 9 单 · ¥2,010.00（不参与排名）')
 assert.equal(d.unattributedText([]),'')
 assert.equal(d.unattributedText([{name:'无推广员',orders:0,net:0}]),'')
 assert.equal(d.distributorBars([{memberId:1,name:'  ',net:1}])[0].name,'未填写姓名')
})

test('commission lines show what actually reached promoters',()=>{
 const lines=d.commissionLines(sample)
 assert.equal(lines[0].value,'¥1,320.00')
 assert.equal(lines[1].value,'¥800.00');assert.match(lines[1].note,/实际到账 ¥784\.00/)
 assert.equal(lines[2].value,'2 笔 · ¥220.00')
 assert.equal(d.commissionLines(null)[2].value,'0 笔 · ¥0.00')
})

test('to-dos point at modules only the person may open',()=>{
 const finance={bound:true,canViewOrders:true,canViewMoney:true,canViewCases:true,canReviewWithdrawals:true}
 const t=Object.fromEntries(d.todoItems(sample.todo,finance).map(x=>[x.key,x]))
 assert.equal(t.pendingShipment.allowed,false);assert.equal(t.pendingShipment.action,'由同事处理');assert.equal(t.pendingShipment.hint,'这类事项由有相应权限的同事处理')
 assert.equal(t.withdrawalsToReview.allowed,true);assert.deepEqual(t.withdrawalsToReview.target,{module:'withdrawals'});assert.equal(t.withdrawalsToReview.action,'去处理 ›')
 assert.equal(t.applications.allowed,false)
 assert.equal(t.wechatShippingFailed.target,null);assert.match(t.wechatShippingFailed.hint,/电脑后台/)
 const shipper=Object.fromEntries(d.todoItems(sample.todo,{canViewOrders:true,canShip:true}).map(x=>[x.key,x]))
 assert.equal(shipper.pendingShipment.allowed,true);assert.deepEqual(shipper.pendingShipment.target,{module:'orders',view:'shipping'})
 const odd=Object.fromEntries(d.todoItems({pendingShipment:-3,afterSalesOpen:'x',wechatShippingFailed:2},null).map(x=>[x.key,x]))
 assert.equal(odd.pendingShipment.count,0);assert.equal(odd.pendingShipment.action,'暂无')
 assert.equal(odd.afterSalesOpen.count,0);assert.equal(odd.afterSalesOpen.action,'暂无')
 assert.equal(odd.wechatShippingFailed.action,'在电脑后台处理')
 assert.equal(d.todoItems(null,null).length,6)
})

test('operator texts carry no technical words',()=>{
 const bad=/接口|参数|同步|错误码|字段|配置|token|null|undefined|NaN|[A-Za-z]{3,}/
 const texts=[...Object.values(d.DASHBOARD_NOTES),...d.RANGES.map(r=>r.label),...d.todoItems({},{}).flatMap(t=>[t.label,t.hint,t.action]),...d.dashboardFigures(sample).flatMap(f=>[f.label,f.value,f.extra,f.extra2]),...d.commissionLines(sample).flatMap(l=>[l.label,l.value,l.note])]
 for(const t of texts)assert.doesNotMatch(t,bad,t)
})
