import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/sold-count.js',import.meta.url),'utf8')
const {soldCountText}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

test('absent sold count shows nothing so hidden or below-threshold products stay quiet',()=>{
 for(const value of [undefined,null,'','abc',NaN,-1,Infinity])assert.equal(soldCountText(value),'')
})
test('small and thousand-level counts are shown as plain numbers',()=>{
 assert.equal(soldCountText(0),'已售 0件')
 assert.equal(soldCountText(7),'已售 7件')
 assert.equal(soldCountText(999),'已售 999件')
 assert.equal(soldCountText(1000),'已售 1000件')
 assert.equal(soldCountText(9999),'已售 9999件')
 assert.equal(soldCountText('256'),'已售 256件')
 assert.equal(soldCountText(12.8),'已售 12件')
})
test('ten thousand and above are rounded down to 万+',()=>{
 assert.equal(soldCountText(10000),'已售 1万+件')
 assert.equal(soldCountText(19999),'已售 1万+件')
 assert.equal(soldCountText(25000),'已售 2万+件')
 assert.equal(soldCountText(1234567),'已售 123万+件')
})
