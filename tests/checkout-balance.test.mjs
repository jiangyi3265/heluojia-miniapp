import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/checkout-balance.js',import.meta.url),'utf8')
const {onlineBalanceDefault}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const retail={checkoutKey:'order_1',channel:'C',partnerPurchase:false,exchange:false,paymentMethod:'simulation',available:500}

test('ordinary retail checkout with recharge balance defaults on once',()=>{
 assert.deepEqual(onlineBalanceDefault(retail),{decidedKey:'order_1',turnOn:true})
})
test('the same checkout is never switched back on after the first decision',()=>{
 assert.deepEqual(onlineBalanceDefault({...retail,decidedKey:'order_1'}),{decidedKey:'order_1',turnOn:false})
})
test('a new checkout decides again',()=>{
 assert.deepEqual(onlineBalanceDefault({...retail,checkoutKey:'order_2',decidedKey:'order_1'}),{decidedKey:'order_2',turnOn:true})
})
test('zero or missing balance is decided as off and stays decided',()=>{
 assert.deepEqual(onlineBalanceDefault({...retail,available:0}),{decidedKey:'order_1',turnOn:false})
 assert.deepEqual(onlineBalanceDefault({...retail,available:undefined}),{decidedKey:'order_1',turnOn:false})
 assert.equal(onlineBalanceDefault({...retail,available:500,decidedKey:'order_1'}).turnOn,false)
})
test('enterprise, partner purchase, points exchange and credit checkout never default on',()=>{
 assert.equal(onlineBalanceDefault({...retail,channel:'B'}).turnOn,false)
 assert.equal(onlineBalanceDefault({...retail,partnerPurchase:true}).turnOn,false)
 assert.equal(onlineBalanceDefault({...retail,exchange:true}).turnOn,false)
 assert.equal(onlineBalanceDefault({...retail,paymentMethod:'credit'}).turnOn,false)
})
test('without a checkout key nothing is decided',()=>{
 assert.deepEqual(onlineBalanceDefault({...retail,checkoutKey:''}),{decidedKey:'',turnOn:false})
})
