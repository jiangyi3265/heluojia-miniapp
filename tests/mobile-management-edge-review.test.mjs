import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// Real component methods; requests, upload, image selection and sessions are isolated stand-ins.
// No file upload, live backend, browser, or native-device operation is performed here.
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const distributors=await loadHelpers('../pages/staff/services/staff-distributors.js')
const {yuan}=await loadHelpers('../services/staff-workbench.js')
const {formatDate}=await loadHelpers('../services/display.js')
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const manager={bound:true,canReviewCustomers:true,canViewCustomers:true,canViewDistributors:true,canRegisterPartnerFees:true,canManageDistributors:true}

async function withUni(run,extra={}){
 const prior=globalThis.uni;globalThis.uni=fakeUni([],true,extra)
 try{return await run()}finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
}

test('客户审核已有列表刷新在途时点全部，最终请求和展示必须匹配全部记录',()=>withUni(async()=>{
 const pending={id:11,nickname:'待审核顾客',distributor_state:'pending',enterprise_state:'none'}
 const approved={id:12,nickname:'已审核顾客',distributor_state:'approved',enterprise_state:'none'}
 const oldRefresh=deferred(),calls=[]
 const request=async path=>{
  calls.push(path)
  assert.ok(['/staff/manage/members?pendingOnly=true','/staff/manage/members'].includes(path))
  if(calls.length===2)return oldRefresh.promise
  return path.includes('pendingOnly=true')?[pending]:[pending,approved]
 }
 const {vm}=loadComponent('../pages/staff/components/StaffManagementPanel.vue',{
  ...management,CaseProofs:{},request,getToken:()=>'member-review-session',asset:x=>x,yuan,formatDate,
  caseProofCount:()=>0,withdrawalReleased:()=>false,withdrawalPaid:()=>false,taxRateText:String
 },{module:'members',me:manager})
 await vm.refresh()
 assert.equal(vm.loaded,true);assert.deepEqual(vm.filtered.map(r=>r.id),[11])
 const refreshing=vm.refresh()
 assert.equal(vm.loading,true);assert.equal(vm.loaded,true,'filter buttons are visible over the previously loaded list')
 vm.setPending(false)
 oldRefresh.resolve([pending]);await refreshing;await settle()
 assert.equal(vm.pendingOnly,false)
 assert.equal(calls.at(-1),'/staff/manage/members','the last intent must issue the unfiltered request even while an old refresh runs')
 assert.equal(vm.loading,false);assert.equal(vm.loaded,true)
 assert.deepEqual(vm.filtered.map(r=>r.id),[11,12],'全部 must include an approved member, not merely relabel pending rows')
}))

function uploadPanel(session,uploadImage){
 const result=loadComponent('../pages/staff/components/StaffDistributors.vue',{
  ...management,...distributors,CaseProofs:{},request:async()=>assert.fail('the child must notify its parent, not bypass access through an extra write'),
  getToken:()=>session.token,API_BASE:'http://127.0.0.1:18130',uploadImage
 },{module:'distributors',me:manager})
 result.vm.detailId=88
 result.vm.detail={member:{memberId:88,nickname:'上传回归推广员'},profile:{applicationState:'approved'},fees:{records:[]},actions:{self:false,canRegisterFee:true,canManage:true}}
 result.vm.view='detail';result.vm.openFee()
 return result
}

for(const message of ['登录已过期，请重新登录后上传','当前岗位无权上传加盟款凭证']){
 test('加盟款凭证上传拒绝“'+message+'”时通知父页面刷新身份',async()=>{
  let selectedJob
  await withUni(async()=>{
   const session={token:'upload-session'},uploads=[]
   const {vm,emitted}=uploadPanel(session,async args=>{uploads.push(args);throw Error(message)})
   vm.chooseProof();await selectedJob
   assert.equal(uploads.length,1)
   assert.equal(uploads[0].url,'http://127.0.0.1:18130/shop/app/staff/manage/distributors/88/fee-proof')
   assert.equal(uploads[0].token,'upload-session')
   assert.equal(vm.formError,message);assert.equal(vm.editor.proofUrl,'')
   assert.equal(vm.busy,false);assert.equal(vm.uploading,false)
   assert.deepEqual(emitted.filter(e=>e[0]==='busy'),[['busy',true],['busy',false]])
   assert.equal(emitted.filter(e=>e[0]==='access-change').length,1,'upload auth refusal must offer the parent login/permission recovery path')
  },{chooseImage:o=>{selectedJob=o.success({tempFilePaths:['local-upload-fixture.png']})}})
 })
}

for(const staleFlag of [true,false]){
 test('上传旧会话迟到失败'+(staleFlag?'带staleSession':'仅token已切换')+'不污染新账号表单或通知父页面',async()=>{
  let selectedJob
  await withUni(async()=>{
   const session={token:'old-upload-session'},pending=deferred(),uploads=[]
   const {vm,emitted}=uploadPanel(session,args=>{uploads.push(args);return pending.promise})
   vm.chooseProof();assert.equal(vm.busy,true);assert.equal(uploads.length,1)
   session.token='new-account-session'
   pending.reject(Object.assign(Error('登录已过期，请重新登录后上传'),staleFlag?{staleSession:true}:{}))
   await selectedJob
   assert.equal(uploads[0].token,'old-upload-session','the upload went out under the login it was started with');assert.equal(vm.editor.proofUrl,'')
   assert.equal(vm.busy,false);assert.equal(vm.uploading,false)
   assert.equal(vm.formError,'','an error from the previous session must not overwrite the current form')
   assert.deepEqual(emitted.filter(e=>e[0]==='access-change'),[])
  },{chooseImage:o=>{selectedJob=o.success({tempFilePaths:['local-upload-fixture.png']})}})
 })
}

test('上传普通网络失败保留可重试提示，不误判为登录失效',async()=>{
 let selectedJob
 await withUni(async()=>{
  const session={token:'same-session'}
  const uploads=[],{vm,emitted}=uploadPanel(session,async args=>{uploads.push(args);throw Error('图片上传失败，请检查网络后重试')})
  vm.chooseProof();await selectedJob
  assert.equal(vm.formError,'图片上传失败，请检查网络后重试')
  assert.equal(uploads.length,1);assert.equal(uploads[0].token,'same-session');assert.equal(vm.busy,false);assert.equal(vm.uploading,false)
  assert.deepEqual(emitted.filter(e=>e[0]==='access-change'),[])
 },{chooseImage:o=>{selectedJob=o.success({tempFilePaths:['local-upload-fixture.png']})}})
})
