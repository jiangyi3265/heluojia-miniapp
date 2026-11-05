import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const load=file=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../services/'+file,import.meta.url),'utf8')).toString('base64'))
const {reviewFocus}=await load('review-focus.js')
const {caseProofCount,caseProofUrl}=await load('case-proofs.js')

const data={eligible:[{id:11,order_no:'A100'},{id:12,order_no:'A100'},{id:21,order_no:'B200'}],reviews:[{id:1,order_id:7},{id:2,order_id:8}]}

test('opening from an order shows only that order and counts the rest',()=>{
 const v=reviewFocus(data,{orderId:7,orderNo:'A100'})
 assert.equal(v.focused,true);assert.deepEqual(v.eligible.map(i=>i.id),[11,12]);assert.deepEqual(v.reviews.map(r=>r.id),[1])
 assert.equal(v.otherEligible,1);assert.equal(v.otherReviews,1)
})
test('order id alone still matches rows that carry order_id',()=>{
 const v=reviewFocus({eligible:[{id:5,order_id:9},{id:6,order_id:10}],reviews:[]},{orderId:'9'})
 assert.deepEqual(v.eligible.map(i=>i.id),[5])
})
test('show all and a plain visit list everything',()=>{
 assert.equal(reviewFocus(data,{orderId:7,orderNo:'A100'},true).eligible.length,3)
 const plain=reviewFocus(data,{})
 assert.equal(plain.focused,false);assert.equal(plain.eligible.length,3);assert.equal(plain.reviews.length,2)
 assert.equal(reviewFocus(null,{orderId:7}).eligible.length,0)
})
test('after-sale photo count comes from the case record and tolerates bad data',()=>{
 assert.equal(caseProofCount({proofs_json:'["/a.png","/b.png"]'}),2)
 assert.equal(caseProofCount({proofs_json:['/a.png']}),1)
 assert.equal(caseProofCount({proofs_json:''}),0);assert.equal(caseProofCount({proofs_json:'{bad'}),0);assert.equal(caseProofCount({}),0);assert.equal(caseProofCount(null),0)
})
test('after-sale photo address points at the private proof download',()=>{
 assert.equal(caseProofUrl('https://api.example.com/',42,1),'https://api.example.com/shop/app/cases/42/proofs/1')
 assert.equal(caseProofUrl('http://127.0.0.1:18080','7','x'),'http://127.0.0.1:18080/shop/app/cases/7/proofs/0')
})
