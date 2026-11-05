import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

// The server makes product thumbnails in four widths only (ShopFilesController); any other width used to
// come back as an error instead of a picture, so order cards and the product list in 手机管理 showed blanks.
const ALLOWED=[160,320,640,960]
const root=fileURLToPath(new URL('..',import.meta.url))
function files(dir){return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?files(path):/\.(vue|js)$/.test(name)?[path]:[]})}

test('every picture asks the server for a width it makes',()=>{
 const found=[]
 for(const file of ['components','pages','services'].flatMap(dir=>files(join(root,dir)))){
  const source=readFileSync(file,'utf8')
  for(const m of source.matchAll(/\basset\(([^()]|\([^()]*\))*?,\s*(\d+)\)/g))found.push([file.slice(root.length),Number(m[2])])
 }
 assert.ok(found.some(([file])=>file.includes('StaffWorkbench')),'the order cards are checked')
 assert.ok(found.some(([file])=>file.includes('StaffManagementPanel')),'the product list is checked')
 for(const [file,width] of found)assert.ok(ALLOWED.includes(width),file+' asks for width '+width)
})

test('the default width is one the server makes',()=>{
 const shop=readFileSync(join(root,'services','shop.js'),'utf8')
 assert.ok(ALLOWED.includes(Number(shop.match(/export const asset = \(path,width=(\d+)\)/)[1])))
})
