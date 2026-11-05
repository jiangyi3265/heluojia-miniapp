import test from 'node:test'
import assert from 'node:assert/strict'
import {rewardSource,rewardPaid} from '../services/distribution-rewards.js'

test('加盟拿货差价 is not shown as a retail commission',()=>{
 assert.equal(rewardSource({business_type:'partner',channel:'C',depth:1}),'加盟拿货差价 · 直属下级拿货')
 assert.equal(rewardSource({business_type:'retail',channel:'C',depth:1}),'零售 · 1级推广')
 assert.equal(rewardSource({business_type:'retail',channel:'C',depth:2}),'零售 · 2级推广')
 assert.equal(rewardSource({business_type:'enterprise',channel:'B',depth:1}),'企业采购 · 1级推广')
 assert.equal(rewardSource({channel:'B',depth:1}),'企业采购 · 1级推广')
 assert.equal(rewardSource({channel:'C'}),'零售 · 1级推广')
 assert.equal(rewardSource(null),'零售 · 1级推广')
})

test('the amount is what was paid for this product, not the whole order',()=>{
 // One order, two products: each commission shows its own product's paid amount.
 assert.deepEqual(rewardPaid({business_type:'retail',order_amount:202400,item_net_amount:176000}),{label:'本商品客户实付',amount:176000})
 assert.deepEqual(rewardPaid({business_type:'retail',order_amount:202400,item_net_amount:26400}),{label:'本商品客户实付',amount:26400})
 assert.deepEqual(rewardPaid({business_type:'partner',order_amount:38000,item_net_amount:38000}),{label:'本商品拿货实付',amount:38000})
 assert.deepEqual(rewardPaid({business_type:'enterprise',channel:'B',item_net_amount:5000}),{label:'本商品采购实付',amount:5000})
 assert.deepEqual(rewardPaid({business_type:'retail',item_net_amount:0,order_amount:100}),{label:'本商品客户实付',amount:0})
 // Older records without a product amount fall back to the order, and say so.
 assert.deepEqual(rewardPaid({business_type:'retail',order_amount:202400,item_net_amount:null}),{label:'订单实付（整单）',amount:202400})
 assert.deepEqual(rewardPaid({order_amount:'1200'}),{label:'订单实付（整单）',amount:1200})
 assert.deepEqual(rewardPaid(undefined),{label:'订单实付（整单）',amount:0})
})
