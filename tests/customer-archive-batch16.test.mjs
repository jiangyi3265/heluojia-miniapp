import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// 第 16 批（店主 10-05）：门店余额退款（店长）；同一个银行流水号已登记成别的收款时，先给店长看说明、确认后再提交。请求、会话、确认框都是替身。
const require=createRequire(import.meta.url)
const {createSSRApp}=require('vue'),{renderToString}=require('vue/server-renderer')
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const c=await loadHelpers('../pages/staff/services/staff-customers.js')
const distributors=await loadHelpers('../pages/staff/services/staff-distributors.js')
const source=rel=>readFileSync(new URL(rel,import.meta.url),'utf8')

const ROLE={
 manager:{bound:true,canViewMoney:true,canViewCustomers:true,canViewCustomerArchive:true,canTopUpCustomers:true,canVoidTopUps:true,canRefundStoreBalance:true,canViewDistributors:true,canRegisterPartnerFees:true,canManageDistributors:true},
 finance:{bound:true,canViewMoney:true,canViewCustomerArchive:true,canTopUpCustomers:true}
}
async function withUni(run,{confirm=true,toasts=[]}={}){
 const prior=globalThis.uni;globalThis.uni=fakeUni(toasts,confirm)
 try{return await run()}finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
}
async function render(vm){
 const template=source('../pages/staff/components/StaffCustomers.vue').match(/<template>([\s\S]*)<\/template>\s*<script>/)[1]
 const app=createSSRApp({template,setup:()=>vm})
 app.config.compilerOptions.isCustomElement=tag=>['view','text','image','input','textarea','picker','switch','scroll-view'].includes(tag)
 app.config.warnHandler=()=>{}
 return (await renderToString(app)).replace(/<!--[\s\S]*?-->/g,'')
}
const detailOf=(extra={})=>({
 member:{memberId:5,nickname:'小王',realName:'王小明',phone:'13800138000',identities:['分销商'],enabled:true,isTest:false,createdAt:'2026-10-01 10:00:00'},
 segment:'buying',orders:{total:0,rows:[]},
 money:{wallet:{legacy:{available:5000,reserved:0},online:{available:0,reserved:0},refundFrozen:0}},
 actions:{canTopUp:true,topUpBlocked:'',canVoid:true,canRefund:true},storeBalanceUsable:true,topups:[],refunds:[{id:41,memberId:5,amount:2000,method:'cash',methodLabel:'现金',reference:'',reason:'退回剩下的预存',createdBy:'赵店长',createdAt:'2026-10-05 10:00'}],
 methods:[{key:'cash',label:'现金'},{key:'bank',label:'对公转账',referenceRequired:true},{key:'wechat',label:'微信转账'},{key:'alipay',label:'支付宝转账'},{key:'other',label:'其他'}],...extra})
function openDetail(me,request,session={token:'staff-t1'}){
 const r=loadComponent('../pages/staff/components/StaffCustomers.vue',{...management,...c,request,getToken:()=>session.token},{module:'customers',me})
 r.vm.view='detail';r.vm.detailId=5;r.vm.detail=detailOf();return r
}

// ---------- 规则 ----------
test('退款表单：金额按分算，不能超过现在能退的门店余额；对公转账要流水号；要写原因',()=>{
 const key=c.newRefundRequestKey(1759550000000,()=>0.987654321);assert.match(key,/^mref_/);assert.match(key,c.TOPUP_REQUEST_KEY)
 const form=(x={})=>({amount:'20',method:'cash',reference:'',reason:'退回剩下的预存',requestKey:key,...x})
 assert.deepEqual(c.readRefundForm(form(),c.TOPUP_METHODS,5000),{body:{amount:2000,method:'cash',reference:'',reason:'退回剩下的预存',requestKey:key}})
 assert.equal(c.readRefundForm(form({amount:'50.01'}),c.TOPUP_METHODS,5000).error,'最多能退 ¥50.00（被待付款订单占用的不能退）')
 assert.equal(c.readRefundForm(form({amount:''})).error,'请填写退款金额')
 assert.equal(c.readRefundForm(form({amount:'1.234'})).error,'请填写正确的金额，最多保留两位小数')
 assert.equal(c.readRefundForm(form({amount:'0'})).error,'退款金额要在 0.01 元到 100 万元之间')
 assert.equal(c.readRefundForm(form({method:'bank',reference:'1 2'})).error,'对公转账退款请填写银行流水号')
 assert.equal(c.readRefundForm(form({method:'bank',reference:'6222 0001'})).body.reference,'62220001')
 assert.equal(c.readRefundForm(form({reason:'退'})).error,'请填写2至300字退款原因')
 assert.equal(c.readRefundForm(form({method:'card'})).error,'请选择退款方式')
 const text=c.refundConfirmText({memberId:5,realName:'王小明',phone:'138****8000'},{amount:2000,method:'cash',reference:''})
 for(const part of ['王小明（会员编号 5，138****8000）','退门店余额 ¥20.00','退款方式：现金','确认钱已经退给客户','不能撤销'])assert.ok(text.includes(part),part)
 assert.equal(c.CUSTOMER_DONE.refund,'已退款，门店余额已扣回');assert.match(c.CUSTOMER_UNCERTAIN.refund,/不会重复退款/)
})

// ---------- 页面 ----------
test('店长在档案里看到“门店余额退款”和退款记录；财务能看记录但没有退款按钮；没有余额时不显示按钮',()=>withUni(async()=>{
 const boss=openDetail(ROLE.manager,async()=>detailOf()).vm
 let html=await render(boss)
 for(const part of ['门店余额退款','门店余额退款记录','退 ¥20.00 · 现金','原因：退回剩下的预存','登记：赵店长'])assert.ok(html.includes(part),part)
 const fin=openDetail(ROLE.finance,async()=>detailOf()).vm;fin.detail=detailOf({actions:{canTopUp:true,topUpBlocked:'',canVoid:false,canRefund:false}})
 html=await render(fin);assert.ok(!html.includes('>门店余额退款<'),'财务没有退款按钮');assert.ok(html.includes('门店余额退款记录'),'财务能看退款记录')
 fin.openRefund();assert.equal(fin.view,'detail','没有权限时打不开退款表单')
 boss.detail=detailOf({money:{wallet:{legacy:{available:0,reserved:3000},online:{available:0}}}})
 html=await render(boss);assert.ok(!html.includes('>门店余额退款<'),'能退的是 0 元（被待付款订单占着）时不显示退款按钮')
 boss.openRefund();assert.equal(boss.view,'detail')
}))
test('店长退款：确认后按原样提交到这位客户的退款地址，用返回的最新档案；超过能退的金额不发请求',()=>withUni(async()=>{
 const posts=[];const fresh=detailOf({money:{wallet:{legacy:{available:3000,reserved:0},online:{available:0}}}})
 const {vm}=openDetail(ROLE.manager,async(path,method,body)=>{if(method==='POST'){posts.push([path,body]);return {refund:{id:42},repeated:false,detail:fresh}}return detailOf()})
 vm.openRefund();assert.equal(vm.view,'editor');assert.equal(vm.editorTitle,'门店余额退款');assert.match(vm.editor.requestKey,/^mref_/)
 vm.editor.amount='60';await vm.submit()
 assert.equal(vm.formError,'最多能退 ¥50.00（被待付款订单占用的不能退）');assert.deepEqual(posts,[])
 const modals=[];globalThis.uni.showModal=o=>{modals.push(o);o.success({confirm:true})}
 vm.editor.amount='20';vm.editor.reason='退回剩下的预存';await vm.submit()
 assert.equal(modals.length,1);assert.equal(modals[0].title,'门店余额退款');assert.equal(modals[0].confirmText,'确认退款');assert.ok(modals[0].content.includes('退门店余额 ¥20.00'))
 assert.deepEqual(posts,[['/staff/manage/customers/5/store-refunds',{amount:2000,method:'cash',reference:'',reason:'退回剩下的预存',requestKey:posts[0][1].requestKey}]])
 assert.equal(vm.view,'detail');assert.deepEqual(vm.detail,fresh);assert.equal(vm.listStale,true)
}))
test('退款结果没收到：表单锁住，再点原样重发同一个请求号（服务器不会重复退款）',()=>withUni(async()=>{
 const posts=[];let lost=true
 const {vm}=openDetail(ROLE.manager,async(path,method,body)=>{if(method==='POST'){posts.push(JSON.parse(JSON.stringify(body)));if(lost){lost=false;const e=Error('网络不稳定');e.uncertain=true;throw e}return {repeated:true,detail:detailOf()}}return detailOf()})
 vm.openRefund();vm.editor.amount='20';vm.editor.reason='退回剩下的预存'
 await vm.submit()
 assert.equal(vm.uncertain,true);assert.equal(vm.pendingRefund.memberId,5);assert.equal(vm.uncertainText,c.CUSTOMER_UNCERTAIN.refund)
 const html=await render(vm);assert.ok(html.includes('原样重新提交'))
 vm.editor.amount='49'
 await vm.submit()
 assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(vm.pendingRefund,null)
}))
test('充值时同一个流水号已登记成加盟款：服务器先答复“请确认”，店长看过说明确认后带确认再提交；不确认就不登记、表单还在',()=>withUni(async()=>{
 const posts=[];const ask={needsConfirmation:true,message:'这个银行流水号已经登记为加盟款 ¥19800.00（会员编号 12）。请核对：这笔转账里确实还有门店预存吗？确认后才登记。'}
 const {vm}=openDetail(ROLE.manager,async(path,method,body)=>{if(method==='POST'){posts.push(JSON.parse(JSON.stringify(body)));return body.confirmSharedReference?{topup:{id:33},repeated:false,detail:detailOf()}:ask}return detailOf()})
 const modals=[];let answer=[true,true]
 globalThis.uni.showModal=o=>{modals.push(o);o.success({confirm:answer.shift()})}
 vm.openTopup();vm.editor.amount='50';vm.editor.method='bank';vm.editor.reference='6222 0001'
 await vm.submit()
 assert.deepEqual(modals.map(m=>m.title),['给客户充值','同一笔转账']);assert.equal(modals[1].content,ask.message);assert.equal(modals[1].confirmText,'确认登记')
 assert.equal(posts.length,2);assert.equal(posts[0].confirmSharedReference,false,"第一次提交就带 false：告诉服务器会弹确认框");assert.equal(posts[1].confirmSharedReference,true)
 assert.equal(posts[1].requestKey,posts[0].requestKey,'第一次什么都没登记，确认后用同一个请求号');assert.equal(vm.view,'detail')
 // 店长看了说明不确认：只发了第一次，什么都没登记，表单还在，可以改内容
 posts.length=0;modals.length=0;answer=[true,false]
 vm.openTopup();vm.editor.amount='50';vm.editor.method='bank';vm.editor.reference='6222 0002'
 await vm.submit()
 assert.equal(posts.length,1);assert.equal(vm.view,'editor');assert.equal(vm.uncertain,false);assert.equal(vm.formError,'');assert.equal(vm.busy,false)
}))
test('手机上登记加盟款也一样：服务器答复“请确认”时先给店长看说明，确认后带确认再提交',()=>withUni(async()=>{
 const posts=[];const ask={needsConfirmation:true,message:'这个银行流水号已经登记为门店充值 ¥50.00（会员编号 5）。请核对：这笔转账里确实还有加盟款吗？确认后才登记。'}
 const request=async(path,method,body)=>{if(method==='POST'){posts.push([path,JSON.parse(JSON.stringify(body))]);return body.confirmSharedReference?{id:51,repeated:false}:ask}return {member:{memberId:88},profile:{applicationState:'approved'},fees:{records:[]},actions:{self:false,canRegisterFee:true,canManage:true}}}
 const {vm}=loadComponent('../pages/staff/components/StaffDistributors.vue',{...management,...distributors,CaseProofs:{},request,getToken:()=>'staff-t1',API_BASE:'http://127.0.0.1',uploadImage:async()=>''},{module:'distributors',me:ROLE.manager})
 vm.detailId=88;vm.detail={member:{memberId:88,nickname:'推广员'},profile:{applicationState:'approved'},fees:{records:[]},actions:{self:false,canRegisterFee:true,canManage:true}};vm.view='detail'
 const modals=[];globalThis.uni.showModal=o=>{modals.push(o);o.success({confirm:true})}
 vm.openFee();vm.editor.amount='19800';vm.editor.method='bank';vm.editor.referenceNo='62220001'
 await vm.submit()
 assert.deepEqual(modals.map(m=>m.title),['登记加盟款','同一笔转账']);assert.equal(modals[1].content,ask.message)
 assert.equal(posts.length,2);assert.equal(posts[0][1].confirmSharedReference,false,"第一次提交就带 false：告诉服务器会弹确认框");assert.equal(posts[1][1].confirmSharedReference,true);assert.equal(posts[1][1].requestKey,posts[0][1].requestKey)
 assert.equal(vm.editor,null,'确认后登记成功，回到详情')
}))
test('顾客的余额明细认得“门店余额退款”',()=>{
 assert.ok(source('../components/WalletPanel.vue').includes("store_refund:'门店余额退款'"))
})

test('复核 B16-3/B16-4：退款表单写“收款报表里计作退款”（手机上的叫法）；停用的客户写明登记错了要先在电脑后台恢复再充值补回',()=>{
 const v=readFileSync(new URL('../pages/staff/components/StaffCustomers.vue',import.meta.url),'utf8')
 assert.match(v,/收款报表里计作退款/)
 assert.doesNotMatch(v,/现金实收里计作退款/)
 assert.match(v,/member&&member\.enabled===false\?'这位客户已停用，登记错了要先在电脑后台恢复这位客户，再充值补回':'登记错了请再给客户充值补回'/)
})
