import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/pickup-store.js',import.meta.url),'utf8')
const {pickupHoursText}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

test('stores with opening hours show them',()=>{
 assert.equal(pickupHoursText({hours:' 每天 9:00-21:00 '}),'营业时间：每天 9:00-21:00')
})
test('stores without opening hours ask the customer to check first',()=>{
 for(const point of [{},{hours:''},{hours:'  '},{hours:null},null,undefined])assert.equal(pickupHoursText(point),'取货前请联系门店确认营业时间')
})
