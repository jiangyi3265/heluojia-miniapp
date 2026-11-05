import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const load=file=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../services/'+file,import.meta.url),'utf8')).toString('base64'))
const {createNavigationGuard}=await load('navigation-guard.js')

test('a second tap on the same page inside the window is ignored',()=>{
 let now=1000;const allow=createNavigationGuard({now:()=>now})
 assert.equal(allow('/pages/product/index?id=1'),true)
 now+=300;assert.equal(allow('/pages/product/index?id=1'),false)
 now+=499;assert.equal(allow('/pages/product/index?id=1'),false)
})
test('the same page opens again once the window has passed',()=>{
 let now=0;const allow=createNavigationGuard({now:()=>now})
 assert.equal(allow('/pages/cart/index'),true)
 now=800;assert.equal(allow('/pages/cart/index'),true)
 now=900;assert.equal(allow('/pages/cart/index'),false)
})
test('a different page or different query is never blocked',()=>{
 let now=0;const allow=createNavigationGuard({now:()=>now})
 assert.equal(allow('/pages/product/index?id=1'),true)
 now=10;assert.equal(allow('/pages/product/index?id=2'),true)
 now=20;assert.equal(allow('/pages/cart/index'),true)
 now=30;assert.equal(allow('/pages/product/index?id=1'),true)
})
test('a clock that moves backwards does not block navigation forever',()=>{
 let now=5000;const allow=createNavigationGuard({now:()=>now})
 assert.equal(allow('/pages/me/index'),true)
 now=100;assert.equal(allow('/pages/me/index'),true)
})
test('go() checks the guard before navigateTo and keeps the redirect fallback',()=>{
 const source=readFileSync(new URL('../services/shop.js',import.meta.url),'utf8')
 assert.match(source,/if\(!allowNavigation\(url\)\)return;uni\.navigateTo\(\{url,fail:\(\)=>uni\.redirectTo\(\{url\}\)\}\)/)
})
