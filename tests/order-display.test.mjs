import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/order-display.js',import.meta.url),'utf8')
const d=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

test('pickup orders show pickup progress instead of shipping words',()=>{
 assert.equal(d.pickupState({delivery_method:'pickup',status:'paid',pickup_status:'pending'}),'待备货')
 assert.equal(d.pickupState({delivery_method:'pickup',status:'paid',pickup_status:'ready'}),'待自提')
 assert.equal(d.pickupState({delivery_method:'pickup',status:'completed',pickup_status:'collected'}),'已取货')
 assert.equal(d.pickupHint({delivery_method:'pickup',status:'paid',pickup_status:'ready'}),'商品已备好，请到店出示取货码取货')
 for(const order of [{delivery_method:'express',status:'paid'},{status:'paid'},{delivery_method:'pickup',status:'pending'},{delivery_method:'pickup',status:'refunded',pickup_status:'pending'},null]){assert.equal(d.pickupState(order),'');assert.equal(d.pickupHint(order),'')}
})

test('balance plus WeChat orders show both parts',()=>{
 const order={payment_mode:'wechat',amount:2640000,wallet_amount:1980000,external_amount:660000,refunded_wallet:660000,refunded_external:220000}
 assert.deepEqual(d.paymentParts(order),{wallet:1980000,wechat:660000})
 assert.equal(d.paymentModeText(order),'余额 + 微信支付')
 assert.equal(d.paymentPartsText(order),'余额支付 ¥19800.00 · 微信支付 ¥6600.00')
 assert.equal(d.refundPartsText(order),'其中退回微信 ¥2200.00，退回余额 ¥6600.00')
 const wechatOnly={payment_mode:'wechat',amount:100,wallet_amount:0,external_amount:100,refunded_wallet:0,refunded_external:100}
 assert.equal(d.paymentParts(wechatOnly),null);assert.equal(d.paymentModeText(wechatOnly),'微信支付');assert.equal(d.paymentPartsText(wechatOnly),'');assert.equal(d.refundPartsText(wechatOnly),'')
 assert.equal(d.paymentParts({payment_mode:null,wallet_amount:100,external_amount:50}),null)
})

test('points exchange orders name their payment',()=>{
 assert.equal(d.paymentModeText({payment_mode:'points_exchange'}),'积分兑换')
 assert.equal(d.exchangeOrder({payment_mode:'points_exchange'}),true)
 assert.equal(d.exchangeOrder({payment_mode:'wechat'}),false)
 assert.equal(d.paymentModeText({payment_mode:'something_new'}),'付款方式待确认')
})

test('after-sale refunds say how much went back to WeChat and to the balance',()=>{
 const done={status:'refunded',payment_mode:'wechat',amount:880000,wechat_refund_amount:220000,order_wallet_amount:1980000}
 assert.deepEqual(d.caseRefundParts(done),{wechat:220000,wallet:660000})
 assert.equal(d.caseRefundText(done),'退回微信 ¥2200.00，退回余额 ¥6600.00')
 assert.equal(d.refundedCaseTitle(done),'退款成功，已按原付款方式退回')
 assert.equal(d.caseRefundText({...done,status:'awaiting_refund'}),'将退回微信 ¥2200.00，退回余额 ¥6600.00')
 assert.equal(d.refundedCaseTitle({...done,wechat_refund_amount:0}),'退款成功，已退回余额')
 const wechatOnly={status:'refunded',payment_mode:'wechat',amount:880000,wechat_refund_amount:880000,order_wallet_amount:0}
 assert.equal(d.caseRefundParts(wechatOnly),null);assert.equal(d.caseRefundText(wechatOnly),'');assert.equal(d.refundedCaseTitle(wechatOnly),'微信原路退款成功')
 assert.equal(d.caseRefundText({...done,status:'pending',wechat_refund_amount:null}),'')
})

test('the discount line no longer repeats the points deduction',()=>{
 assert.equal(d.offerDiscount({discount:22000,pointsDiscount:22000}),0)
 assert.equal(d.offerDiscount({discount:32000,pointsDiscount:22000}),10000)
 assert.equal(d.offerDiscount({discount:5000,points_discount:2000}),3000)
 assert.equal(d.offerDiscount({discount:5000}),5000)
 assert.equal(d.offerDiscount(null),0)
})

test('a switched-off promoter with earnings keeps the money view',()=>{
 const member={distributor_state:'rejected',distributor_note:'停用测试'}
 assert.equal(d.distributionStopped(member,{available:15000,commission:[],withdrawals:[]}),true)
 assert.equal(d.distributionStopped(member,{available:0,commission:[{id:1}],withdrawals:[]}),true)
 assert.equal(d.distributionStopped(member,{available:0,commission:[],withdrawals:[{id:2}]}),true)
 assert.equal(d.distributionStopped(member,{available:-300,commission:[],withdrawals:[]}),true)
 assert.equal(d.distributionStopped(member,{available:0,commission:[],withdrawals:[],customers:[]}),false)
 assert.equal(d.distributionStopped({distributor_state:'approved'},{available:15000,commission:[{id:1}]}),false)
 assert.equal(d.distributionStopped({distributor_state:'none'},{available:15000}),false)
 assert.equal(d.distributionStopped(member,null),false)
})
test('a refund WeChat closed or could not deliver never promises automatic arrival',()=>{
 const cases=[{order_id:9,status:'awaiting_refund',wechat_refund_state:'CLOSED'},{order_id:10,status:'awaiting_refund',wechat_refund_state:'PROCESSING'},{order_id:11,status:'awaiting_refund',wechat_refund_state:'ABNORMAL'},{order_id:12,status:'refunded',wechat_refund_state:'CLOSED'}]
 assert.match(d.stalledRefundHint(cases,'9'),/商家将重新发起退款/);assert.doesNotMatch(d.stalledRefundHint(cases,9),/自动更新/)
 assert.equal(d.stalledRefundTitle(cases[0]),'微信退款未成功，待商家重新发起')
 assert.match(d.stalledRefundHint(cases,11),/商家正在处理/);assert.equal(d.stalledRefundTitle(cases[2]),'退款暂未到账，商家处理中')
 for(const id of [10,12,99])assert.equal(d.stalledRefundHint(cases,id),'')
 assert.equal(d.stalledRefundTitle(cases[1]),'');assert.equal(d.stalledRefundTitle(cases[3]),'');assert.equal(d.stalledRefundTitle(null),'')
 assert.equal(d.stalledRefundHint(null,9),'')
})
