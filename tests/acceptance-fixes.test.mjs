import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// 2026-09-29 验收发现的顾客端/推广端问题的回归检查。
const screen=readFileSync(new URL('../components/ShopScreen.vue',import.meta.url),'utf8')
const withdrawal=readFileSync(new URL('../components/WithdrawalPanel.vue',import.meta.url),'utf8')
const distribution=readFileSync(new URL('../components/DistributionPanel.vue',import.meta.url),'utf8')
const lookup=readFileSync(new URL('../pages/staff/components/StaffLookup.vue',import.meta.url),'utf8')
const panel=readFileSync(new URL('../pages/staff/components/StaffManagementPanel.vue',import.meta.url),'utf8')
const displayed=new Function(screen.match(/displayedOrders\(\)\{(return this\.orders\.filter\(.*?\))\},majorGroups/)[1])

test('C4 待收货包含部分发货的订单，“全部订单”只在没有筛选时高亮',()=>{
 const orders=[{id:1,channel:'C',status:'shipping',business_type:'retail'},{id:2,channel:'C',status:'shipped',business_type:'retail'},{id:3,channel:'C',status:'paid',business_type:'retail'}]
 assert.deepEqual(displayed.call({orders,channel:'C',orderFilter:'shipped',orderBusiness:''}).map(o=>o.id),[1,2])
 assert.deepEqual(displayed.call({orders,channel:'C',orderFilter:'paid',orderBusiness:''}).map(o=>o.id),[3])
 assert.deepEqual(displayed.call({orders,channel:'C',orderFilter:'',orderBusiness:''}).map(o=>o.id),[1,2,3])
 assert.match(screen,/<text :class="\{on:!orderBusiness&&!orderFilter\}"[^>]*>全部订单<\/text><text v-if="orderFilter" class="on"/)
})

test('D4 佣金明细也列出按商品计算的佣金，空状态只在两类都没有时显示',()=>{
 assert.match(screen,/<view v-for="r in distribution\.lineRewards\|\|\[\]"/)
 assert.match(screen,/订单 \{\{r\.order_no\}\}/)
})

test('D7 佣金被冻结时提现页直接说明原因并不能提交',()=>{
 assert.match(withdrawal,/v-if="distribution\.frozen"[^>]*>佣金已被冻结，暂时不能提现/)
 assert.match(withdrawal,/:disabled="busy\|\|!isWechat\|\|!distribution\.withdrawalReady\|\|distribution\.frozen\|\|/)
})

test('D5 推荐人编号无效或已有推荐人时给出提示；D15 二级成员不产生佣金时写明',()=>{
 assert.match(distribution,/r\?\.state==='ignored'\)uni\.showToast\(\{title:'推荐人编号无效/)
 assert.match(distribution,/r\?\.state==='kept'\)uni\.showToast/)
 assert.match(distribution,/data\.settings\.secondEnabled\?'二级成员':'二级成员（不产生佣金）'/)
})

test('C9 取消时发现已付款要告诉顾客；C12 空规格显示默认规格；C16/C17/C18 文案与数量',()=>{
 assert.match(screen,/if\(result\?\.paid\)uni\.showModal\(\{title:'订单已付款'/)
 assert.match(screen,/\{\{selectedProduct\.spec\|\|'默认规格'\}\}/)
 assert.match(screen,/\{\{v\.spec\|\|'默认规格'\}\}/)
 assert.match(screen,/预估合计：/)
 assert.match(screen,/v-for="p in products\.slice\(0,6\)"/)
 assert.match(screen,/screen==='address-edit'&&query\.id\?'编辑地址'/)
})

test('D16 分销申请上传核验资料失败时显示原因和重试',()=>{
 const block=screen.slice(screen.indexOf(`<template v-if="screen==='distributor-apply'&&distributionApplication.required">`))
 const end=block.indexOf('</template>')
 assert.ok(end>0)
 assert.match(block.slice(0,end),/licenseError[\s\S]*重试上传/)
})

test('M3 按手机号查到但账号没留手机号时说明是收货或下单电话',()=>{
 assert.match(lookup,/\['phone','phoneTail'\]\.includes\(searchedKind\)\?'账号未留手机号（收货或下单电话与查询一致）'/)
})

test('D14 企业认证入口不再显示一个提交必失败的表单，改为说明并引导去申请分销商',()=>{
 const start=screen.indexOf(`<template v-if="screen==='enterprise-apply'">`)
 assert.ok(start>0)
 const block=screen.slice(start,screen.indexOf('</template>',start))
 assert.match(block,/企业认证已合并到分销商申请/)
 assert.match(block,/go\('distributor-apply'\)/)
 assert.doesNotMatch(block,/submitApplication/)
 // 表单只在分销商申请页出现
 assert.match(screen,/<template v-if="screen==='distributor-apply'"><view class="white-card form">/)
})

test('M17 手机管理端“待处理”客户由服务器筛选，切换时重新读取',async()=>{
 const management=await loadHelpers('../pages/staff/services/staff-management.js')
 const {yuan}=await loadHelpers('../services/staff-workbench.js')
 const {formatDate}=await loadHelpers('../services/display.js')
 const pending={id:17,distributor_state:'pending',enterprise_state:'none'},approved={id:18,distributor_state:'approved',enterprise_state:'none'}
 const calls=[];let releaseOld
 const oldResponse=new Promise(resolve=>{releaseOld=resolve})
 const request=async path=>{calls.push(path);if(calls.length===2)return oldResponse;return path.includes('?pendingOnly=true')?[pending]:[pending,approved]}
 const prior=globalThis.uni;globalThis.uni=fakeUni()
 try{
  const {vm}=loadComponent('../pages/staff/components/StaffManagementPanel.vue',{
   ...management,CaseProofs:{},request,getToken:()=>'m17-local-session',asset:x=>x,yuan,formatDate,
   caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:String
  },{module:'members',me:{bound:true,canViewCustomers:true,canReviewCustomers:true}})
  await vm.refresh()
  assert.deepEqual(calls,['/staff/manage/members?pendingOnly=true'],'待处理 must be requested from the server, not only filtered locally')
  assert.deepEqual(vm.filtered.map(r=>r.id),[17])
  const oldRefresh=vm.refresh()
  assert.equal(vm.loading,true);assert.deepEqual(vm.filtered.map(r=>r.id),[17],'the earlier list stays visible while it is read again')
  await vm.setPending(false);await settle()
  assert.equal(calls.at(-1),'/staff/manage/members','全部 must trigger an unfiltered server read')
  assert.deepEqual(vm.filtered.map(r=>r.id),[17,18])
  releaseOld([pending]);await oldRefresh;await settle()
  assert.equal(vm.pendingOnly,false);assert.deepEqual(vm.filtered.map(r=>r.id),[17,18],'late pending-only rows cannot overwrite the newer complete list')
  await vm.setPending(true);await settle()
  assert.equal(calls.at(-1),'/staff/manage/members?pendingOnly=true')
  assert.deepEqual(vm.filtered.map(r=>r.id),[17]);assert.equal(vm.loading,false);assert.equal(vm.loaded,true)
 }finally{releaseOld([pending]);if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
 assert.match(panel,/@click="setPending\(true\)">待处理<\/button><button :class="\{chosen:!pendingOnly\}" @click="setPending\(false\)">全部记录/)
})
