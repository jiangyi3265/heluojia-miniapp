import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const helpers=await loadHelpers('../pages/staff/services/staff-distributors.js')

const tiers=[{name:'银卡',rate:3800,referenceAmount:1980000},{name:'金卡',rate:2800,referenceAmount:4980000},{name:'钻石',rate:2200,referenceAmount:9800000}]
const detail=()=>({member:{memberId:88,nickname:'新朋友',realName:'王推广',phoneTail:'5555',applicationState:'approved',accountEnabled:true,createdAt:'2026-08-02 10:11:12'},
 profile:{enabled:true,distributor:true,applicationState:'approved',tier:1,mode:'auto',feeTotal:1980000,automaticTier:1,tierSource:'fee',discountRates:[3800,2800,2200],thresholds:[1980000,4980000,9800000],tiers,name:'银卡',rate:3800,referenceAmount:1980000,nextAmount:4980000,remainingAmount:3000000,nextRate:2800},
 fees:{records:[{id:31,amount:1980000,paidAt:'2026-09-20 14:30',method:'bank',methodLabel:'银行转账',referenceNo:'HX1',hasProof:false,note:'',state:'valid',createdBy:'boss（小程序）',createdAt:'2026-09-20 14:35',voidedBy:null,voidedAt:'',voidReason:null}],totals:{validAmount:1980000,validCount:1},truncated:false},
 commission:{current:{source:'partner_tier',rate:6200},single:{rate:7000},afterRemove:{source:'partner_tier',rate:6200}},
 performance:{thisMonth:{net:0,orders:0},lastMonth:{net:0,orders:0}},
 actions:{self:false,canRegisterFee:true,canManage:true}})
const manager={bound:true,canViewDistributors:true,canRegisterPartnerFees:true,canManageDistributors:true}
const finance={bound:true,canViewDistributors:true,canRegisterPartnerFees:true,canManageDistributors:false}
const rows=n=>Array.from({length:n},(_,i)=>({memberId:1000+i,realName:'分销商'+i,applicationState:'approved',accountEnabled:true,tierSource:'none',thresholds:[1980000],discountRates:[3800]}))

// server(path,method,body) answers; every call is recorded.
function mount(server,me=manager){
 const calls=[]
 const request=async(path,method='GET',body)=>{calls.push({path,method,body});return server(path,method,body)}
 const deps={CaseProofs:{},request,getToken:()=>'staff-token',API_BASE:'http://mock',uploadImage:async()=>'',...management,...helpers}
 const mounted=loadComponent('../pages/staff/components/StaffDistributors.vue',deps,{module:'distributors',me})
 return {...mounted,calls}
}
function withUni(fn,confirm=true){return async()=>{const toasts=[],modals=[];globalThis.uni=fakeUni(toasts,o=>{modals.push(o);return typeof confirm==='function'?confirm(o):confirm});try{await fn(toasts,modals)}finally{delete globalThis.uni}}}
const onDetail=vm=>{vm.detailId=88;vm.detail=detail();vm.view='detail'}
const uncertain=msg=>Object.assign(Error(msg||'无法连接服务，请检查网络后重试'),{uncertain:true})

test('list page commits only on success; a late page cannot overwrite a new search',withUni(async()=>{
 let failPage=false
 const {vm,calls}=mount(async path=>{if(failPage&&/page=2/.test(path))throw Error('翻页没有成功');return {total:45,rows:rows(20)}})
 await vm.loadList(false)
 const first=vm.rows
 failPage=true;await vm.loadList(true)
 assert.equal(vm.page,1);assert.equal(vm.rows,first);assert.equal(vm.error,'翻页没有成功')
 assert.match(calls.at(-1).path,/page=2/)
 const slow=[]
 const b=mount(path=>/q=%E7%8E%8B%E4%BA%94/.test(path)?new Promise(r=>slow.push(r)):Promise.resolve({total:1,rows:[{memberId:7,realName:'李四'}]}))
 b.vm.q='王五';b.vm.search()
 b.vm.q='李四';b.vm.search();await settle()
 slow[0]({total:1,rows:[{memberId:9,realName:'王五'}]});await settle()
 assert.deepEqual(b.vm.rows.map(r=>r.realName),['李四']);assert.equal(b.vm.searched,'李四')
}))

test('a malformed search never reaches the server',withUni(async()=>{
 const {vm,calls}=mount(async()=>({total:0,rows:[]}))
 vm.q='12345';vm.search()
 assert.equal(calls.length,0);assert.equal(vm.error,'请输入完整的11位手机号、手机号后4位，或在会员号前加 #（例如 #123）')
}))

test('filter change restarts from page 1 and loadMore stops at total',withUni(async()=>{
 const {vm,calls}=mount(async path=>/filter=buying/.test(path)?{total:20,rows:rows(20)}:{total:45,rows:rows(20)})
 await vm.loadList(false);await vm.loadList(true)
 assert.match(calls.at(-1).path,/page=2/)
 vm.setFilter('buying');await settle()
 assert.match(calls.at(-1).path,/filter=buying&page=1$/);assert.doesNotMatch(calls.at(-1).path,/size=/)
 assert.equal(vm.rows.length,vm.total)
 const n=calls.length;vm.loadMore();await settle()
 assert.equal(calls.length,n)
 vm.setFilter('buying');assert.equal(calls.length,n)
}))

test('bottom of the list loads the next page once',withUni(async()=>{
 const {vm,calls}=mount(async path=>({total:45,rows:/page=2/.test(path)?rows(40).slice(20):rows(20)}))
 await vm.loadList(false)
 vm.loadMore();vm.loadMore();await settle()
 assert.equal(calls.filter(c=>/page=2/.test(c.path)).length,1);assert.equal(vm.rows.length,40);assert.equal(vm.page,2)
 vm.view='detail';vm.loadMore();assert.equal(calls.length,2)
}))

test('fee registration keeps one request key and an uncertain answer locks the same body',withUni(async(toasts,modals)=>{
 let first=true
 const {vm,calls}=mount(async(path,method)=>{if(method==='POST'){if(first){first=false;throw uncertain()}return {id:32,repeated:true,detail:{}}}return detail()})
 onDetail(vm);vm.openFee()
 vm.editor.amount='30000';vm.editor.method='cash'
 await vm.submit()
 assert.equal(vm.uncertain,true);assert.equal(vm.pendingFee.memberId,88);assert.equal(vm.view,'editor')
 const sent=calls.find(c=>c.method==='POST')
 assert.equal(sent.path,'/staff/manage/distributors/88/fees');assert.equal(sent.body.amount,3000000);assert.match(sent.body.requestKey,helpers.FEE_REQUEST_KEY)
 vm.editor.amount='1'
 await vm.submit()
 const posts=calls.filter(c=>c.method==='POST')
 assert.equal(posts.length,2);assert.deepEqual(posts[1].body,posts[0].body)
 assert.equal(modals.at(-1).content,helpers.feeRetryConfirmText(posts[0].body));assert.equal(modals.at(-1).confirmText,'确认提交')
 assert.equal(toasts.at(-1),'这笔已登记过，没有重复计入')
}))

test('reopening the form after an uncertain answer restores the locked form',withUni(async()=>{
 const {vm}=mount(async(path,method)=>{if(method==='POST')throw uncertain();return detail()})
 onDetail(vm);vm.openFee();vm.editor.amount='100';await vm.submit()
 const editor=vm.editor
 vm.closeEditor();assert.equal(vm.view,'detail');assert.equal(vm.pendingHere,true)
 vm.openFee()
 assert.equal(vm.uncertain,true);assert.equal(vm.editor,editor);assert.equal(vm.view,'editor')
}))

test('repeated answer is reported as not counted twice',withUni(async toasts=>{
 const {vm,calls}=mount(async(path,method)=>method==='POST'?{id:31,repeated:true,detail:{}}:detail())
 onDetail(vm);vm.openFee();vm.editor.amount='19800'
 await vm.submit();await settle()
 assert.equal(toasts.at(-1),'这笔已登记过，没有重复计入');assert.equal(vm.pendingFee,null);assert.equal(vm.view,'detail');assert.equal(vm.editor,null)
 assert.equal(calls.at(-1).path,'/staff/manage/distributors/88');assert.equal(vm.listStale,true)
}))

test('unchanged answer is reported as no change',withUni(async toasts=>{
 const {vm}=mount(async(path,method)=>method==='POST'?{changed:false,detail:{}}:detail())
 onDetail(vm);vm.openTier();vm.editor.mode='fixed';vm.editor.tier=2
 await vm.submit()
 assert.equal(toasts.at(-1),'和现在的设置一样，没有改动')
}))

test('uncertain void, tier and commission cannot be sent again even if submit is called directly',withUni(async()=>{
 const {vm,calls}=mount(async()=>assert.fail('must not call the server'))
 onDetail(vm)
 for(const open of [()=>vm.openVoid(vm.detail.fees.records[0]),()=>vm.openTier(),()=>vm.openCommission('set')]){open();vm.uncertain=true;vm.editor.reason='重复登记';await vm.submit()}
 assert.equal(calls.length,0)
}))

test('an uncertain tier change locks and asks to check first',withUni(async()=>{
 const {vm,calls}=mount(async(path,method)=>{if(method==='POST')throw uncertain();return detail()})
 onDetail(vm);vm.openTier();vm.editor.mode='blocked'
 await vm.submit()
 assert.equal(vm.uncertain,true);assert.equal(vm.pendingFee,null);assert.equal(vm.uncertainText,helpers.DISTRIBUTOR_UNCERTAIN.tier)
 await vm.submit();assert.equal(calls.filter(c=>c.method==='POST').length,1)
 vm.closeAndCheck();await settle()
 assert.equal(vm.view,'detail');assert.equal(calls.at(-1).path,'/staff/manage/distributors/88')
}))

test('tier change always sends mode',withUni(async()=>{
 const {vm,calls}=mount(async(path,method)=>method==='POST'?{changed:true,detail:{}}:detail())
 onDetail(vm);vm.detail.profile.mode='fixed';vm.detail.profile.tier=2
 vm.openTier();assert.equal(vm.editor.tier,2);vm.editor.mode='auto'
 await vm.submit()
 const post=calls.find(c=>c.method==='POST')
 assert.equal(post.path,'/staff/manage/distributors/88/tier');assert.deepEqual(post.body,{mode:'auto'})
}))

test('single-rate removal sends the action',withUni(async(toasts,modals)=>{
 const {vm,calls}=mount(async(path,method)=>method==='POST'?{changed:true,detail:{}}:detail())
 onDetail(vm);vm.openCommission('remove');vm.editor.reason='合作结束'
 await vm.submit()
 const post=calls.find(c=>c.method==='POST')
 assert.equal(post.path,'/staff/manage/distributors/88/commission');assert.deepEqual(post.body,{action:'remove',reason:'合作结束'})
 assert.equal(modals[0].title,'取消单独比例');assert.equal(modals[0].confirmText,'确认取消');assert.equal(toasts.at(-1),'已保存')
 vm.view='detail';vm.detail=detail();vm.openCommission('set');assert.equal(vm.editor.percent,'70')
}))

test('void sends the reason to the fee record',withUni(async()=>{
 const {vm,calls}=mount(async(path,method)=>method==='POST'?{changed:true,detail:{}}:detail())
 onDetail(vm);vm.openVoid(vm.detail.fees.records[0]);vm.editor.reason='a'
 await vm.submit();assert.equal(vm.formError,'请填写2至300字作废原因');assert.equal(calls.length,0)
 vm.editor.reason='重复登记';await vm.submit()
 assert.deepEqual(calls[0],{path:'/staff/manage/distributors/fees/31/void',method:'POST',body:{reason:'重复登记'}})
}))

test('own record hides every write',withUni(async()=>{
 const {vm}=mount(async()=>detail())
 onDetail(vm);vm.detail.actions={self:true,canRegisterFee:false,canManage:false}
 assert.equal(vm.self,true);assert.equal(vm.canManage,false);assert.equal(vm.canRegister,false);assert.equal(vm.writable,false)
}))

test('finance can register but not manage',withUni(async()=>{
 const {vm}=mount(async()=>detail(),finance)
 onDetail(vm);vm.detail.actions={self:false,canRegisterFee:true,canManage:false}
 assert.equal(vm.canRegister,true);assert.equal(vm.canManage,false)
 vm.detail.actions={self:false,canRegisterFee:true,canManage:true}
 assert.equal(vm.canManage,false,'the me flag also has to allow it')
}))

test('cancelled confirmation sends nothing',withUni(async()=>{
 const {vm,calls,emitted}=mount(async()=>assert.fail('must not call the server'))
 onDetail(vm);vm.openFee();vm.editor.amount='19800'
 await vm.submit()
 assert.equal(calls.length,0);assert.equal(vm.busy,false);assert.equal(vm.editor.sentBody,null)
 assert.deepEqual(emitted.filter(e=>e[0]==='busy').map(e=>e[1]),[true,false])
},false))

test('permission refusal asks the workbench to re-check',withUni(async()=>{
 const {vm,emitted}=mount(async()=>{throw Error('你的岗位没有这项权限')})
 await vm.loadList(false)
 assert.ok(emitted.some(e=>e[0]==='access-change'))
}))

test('refresh never discards an open editor',withUni(async()=>{
 const {vm,calls}=mount(async()=>detail())
 onDetail(vm);vm.openFee();vm.editor.amount='5'
 await vm.refresh()
 assert.equal(calls.length,0);assert.equal(vm.editor.amount,'5')
}))
