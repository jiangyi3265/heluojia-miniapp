import test from 'node:test'
import assert from 'node:assert/strict'
import {needsProfile} from '../services/member-profile.js'
import {readFileSync} from 'node:fs'

test('一键登录后还叫“新朋友”或没有任何手机号，就要先完善资料',()=>{
 assert.equal(needsProfile(null),false)
 assert.equal(needsProfile({id:1,nickname:'新朋友',phone:'13800001234'}),true)
 assert.equal(needsProfile({id:1,nickname:'微信用户',contact_phone:'13800001234'}),true)
 assert.equal(needsProfile({id:1,nickname:'  ',phone:'13800001234'}),true)
 assert.equal(needsProfile({id:1,nickname:'王小美',phone:'',contact_phone:''}),true)
 assert.equal(needsProfile({id:1,nickname:'王小美',phone:'13800001234'}),false)
 assert.equal(needsProfile({id:1,nickname:'王小美',phone:null,contact_phone:'13800001234'}),false)
})

test('登录后缺资料先去完善资料页，完成后再回原来要去的页面；我的页显示会员编号',()=>{
 const screen=readFileSync(new URL('../components/ShopScreen.vue',import.meta.url),'utf8')
 assert.match(screen,/if\(memberNeedsProfile\(data\.member\)\)\{uni\.redirectTo\(\{url:'\/pages\/settings\/index\?complete=1'\}\);return\}this\.continueAfterLogin\(\)/)
 assert.match(screen,/profileSaved\(\)\{if\(this\.query\?\.complete\)this\.continueAfterLogin\(\);else this\.refresh\(\)\}/)
 assert.match(screen,/会员编号 \{\{member\.id\}\}/)
 const form=readFileSync(new URL('../components/ProfileComplete.vue',import.meta.url),'utf8')
 assert.match(form,/open-type="getPhoneNumber" @getphonenumber="onPhone"/)
 assert.match(form,/request\('\/account\/wechat-phone','POST',\{code\}\)/)
 assert.match(form,/request\('\/account\/basic-profile','POST',\{nickname:name,contactPhone:this\.verified\?'':phone\}\)/)
})
