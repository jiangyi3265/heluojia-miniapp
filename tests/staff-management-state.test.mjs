import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const {reactive,watch,nextTick}=createRequire(import.meta.url)('vue')

// Execute the component's real request/state methods without a browser or live API.
const source=readFileSync(new URL('../pages/staff/components/StaffManagementPanel.vue',import.meta.url),'utf8')
const helpers=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../pages/staff/services/staff-management.js',import.meta.url),'utf8')).toString('base64'))
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .+$/gm,'').replace('export default','return')
function panelOptions(request,extra={}){
 const deps={...helpers,CaseProofs:{},request,getToken:()=> 'test-session',asset:x=>x,yuan:x=>String(x),caseProofCount:()=>0,formatDate:x=>String(x||''),withdrawalReleased:r=>['rejected','failed'].includes(r?.status),withdrawalPaid:r=>r?.transfer_state==='SUCCESS',taxRateText:r=>String(r),...extra}
 return Function(...Object.keys(deps),script)(...Object.values(deps))
}
function panel(request,extra={}){
 const component=panelOptions(request,extra)
 const vm={...component.data(),module:'cash',$emit(){}}
 for(const [name,method] of Object.entries(component.methods))vm[name]=method.bind(vm)
 for(const [name,getter] of Object.entries(component.computed||{}))Object.defineProperty(vm,name,{get:()=>getter.call(vm),configurable:true})
 return vm
}
// A native mini-program keeps the same component and changes its props. Exercise the real Vue watcher.
function switchingPanel(request,module='products'){
 const component=panelOptions(request),emitted=[]
 const vm=reactive({...component.data(),module,$emit:(...event)=>emitted.push(event),$nextTick:f=>f()})
 for(const [name,method] of Object.entries(component.methods))vm[name]=method.bind(vm)
 const stop=watch(()=>vm.module,component.watch.module.bind(vm))
 return {vm,emitted,stop}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
// The phone's real money text (services/staff-workbench.js has no imports), so the confirmation is checked word for word.
const {yuan:money}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../services/staff-workbench.js',import.meta.url),'utf8')).toString('base64'))
const closable={id:57,member_id:1203,realName:'赵推广',nickname:'关闭示例',phoneTail:'6666',amount:30000,fee:100,tax_amount:0,service_fee:300,status:'unknown',review_status:'approved',transfer_state:'UNKNOWN',canApprove:false,canReject:false,canQuery:true,canClose:true,closeBlock:'',closedKind:''}
function withUni(run){const shown=[];globalThis.uni={showModal:o=>{shown.push(o);o.success({confirm:true})},pageScrollTo(){},showToast(){}};return Promise.resolve(run(shown)).finally(()=>{delete globalThis.uni})}

test('first cash failure does not turn unavailable data into zero receipts',async()=>{
 const vm=panel(async()=>{throw Error('暂时连接失败')})
 await vm.refresh()
 assert.equal(vm.loaded,false);assert.equal(vm.loading,false);assert.equal(vm.error,'暂时连接失败')
})

test('cash pagination commits its page only on success and keeps the displayed date range',async()=>{
 let failed=false;const urls=[]
 const vm=panel(async url=>{urls.push(url);if(failed)throw Error('翻页失败');return {details:[{reference:url}],bySource:[],detailTotal:45}})
 vm.from='2026-01-01';vm.to='2026-01-31';await vm.refresh()
 const original=vm.cashData
 vm.from='2026-02-01';vm.to='2026-02-28';failed=true;await vm.loadCash(2,true)
 assert.equal(vm.cashPage,1);assert.equal(vm.cashData,original);assert.equal(vm.error,'翻页失败')
 failed=false;await vm.loadCash(2,true)
 assert.equal(vm.cashPage,2);assert.match(urls.at(-1),/from=2026-01-01&to=2026-01-31&page=2/)
 await vm.loadCash(1,true);assert.match(urls.at(-1),/from=2026-01-01&to=2026-01-31&page=1/)
 await vm.refresh();assert.equal(vm.cashPage,1);assert.deepEqual(vm.cashData.period,{from:'2026-02-01',to:'2026-02-28'})
})

test('late cash response after leaving the panel cannot overwrite its data',async()=>{
 let resolve;const vm=panel(()=>new Promise(r=>{resolve=r}))
 const pending=vm.refresh();vm.sequence++;resolve({bySource:[{received:99900}],details:[]});await pending
 assert.equal(vm.loaded,false);assert.deepEqual(vm.cashData,{})
})

test('uncertain financial and product operations cannot submit again even if called directly',async()=>{
 const vm=panel(async()=>{assert.fail('must not call the server')})
 vm.editor={};vm.uncertain=true;vm.body=()=>assert.fail('must not start another submission')
 for(const module of ['products','members','cases','withdrawals']){vm.module=module;await vm.submit()}
})

test('member review subtitle and confirmation name the applicant with the member number',async()=>{
 let shown='';globalThis.uni={showModal:o=>{shown=o.content;o.success({confirm:false})},pageScrollTo(){}}
 try{
  const vm=panel(async()=>assert.fail('a cancelled confirmation must not call the server'));vm.module='members';vm.$nextTick=f=>f()
  const row={id:16,nickname:'新朋友',distributor_state:'pending',distributor_data:JSON.stringify({name:'分销丙',phone:'13800001234'})}
  vm.editMember(row,'distributor');assert.equal(vm.editor.subtitle,'分销丙 · 会员编号 16')
  vm.editor.note='资料已核对';await vm.submit()
  assert.equal(shown,'确认通过分销丙（会员编号 16）的分销商申请？')
 }finally{delete globalThis.uni}
})

// 核实后关闭并退回 (transfer-reject-spec §8, §9.3)
test('closeSheetWordingAndBody',()=>withUni(()=>{
 const vm=panel(async()=>assert.fail('opening the sheet must not call the server'));vm.module='withdrawals';vm.$nextTick=f=>f()
 vm.editWithdrawal(closable,'close')
 assert.equal(vm.editor.title,'核实关闭并退回');assert.equal([...vm.editor.title].length,7);assert.equal(vm.editor.subtitle,'赵推广 · 会员编号 1203')
 vm.editor.note=' 已在商户平台核实没有这笔转账 ';assert.deepEqual(vm.body(),{state:'close',note:'已在商户平台核实没有这笔转账'})
 vm.editor.note='a';assert.throws(()=>vm.body(),{message:'请填写至少2字的处理依据'})
 assert.match(source,/<button v-if="r\.canClose" class="small-button" :disabled="busy" @click="editWithdrawal\(r,'close'\)">核实后关闭并退回<\/button>/)
 assert.match(source,/r\.closedKind\?'已关闭，金额已退回':withdrawalStatus\(r\)/)
 assert.match(source,/r\.staffNote\|\|r\.transfer_note\|\|r\.note/)
 assert.match(source,/<view v-if="editor\.state==='close'" class="strong"><text>关闭后退回可提现佣金<\/text><text>\{\{yuan\(editor\.row\.amount\)\}\}<\/text><\/view>/,'closing returns the whole amount, so the sheet never shows a transfer amount')
 assert.match(source,/系统会先向微信再查一次：微信确认没有这笔转账，才会关闭并把 \{\{yuan\(editor\.row\.amount\)\}\} 退回推广员的可提现佣金；微信查到了就不会关闭。/)
}))

test('closeConfirmNamesPersonMemberNumberAndAmount',()=>withUni(async shown=>{
 const vm=panel(async()=>({}),{yuan:money});vm.module='withdrawals';vm.$nextTick=f=>f()
 vm.editWithdrawal(closable,'close');vm.editor.note='已在商户平台核实没有这笔转账';await vm.submit()
 assert.equal(shown[0].title,'核实关闭并退回')
 assert.equal(shown[0].content,'确认向微信核实后关闭赵推广（会员编号 1203，手机尾号 6666）这笔 ¥300.00 的提现，并退回可提现佣金？')
 assert.ok(shown[0].content.includes('会员编号 1203')&&shown[0].content.includes('¥300.00'))
}))

test('closePostsToTheWithdrawalAndLocksWhenUncertain',()=>withUni(async()=>{
 const calls=[];const vm=panel(async(url,method,body)=>{calls.push({url,method,body});throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})});vm.module='withdrawals';vm.$nextTick=f=>f()
 vm.editWithdrawal(closable,'close');vm.editor.note='已在商户平台核实没有这笔转账';await vm.submit()
 assert.deepEqual(calls,[{url:'/staff/manage/withdrawals/57',method:'POST',body:{state:'close',note:'已在商户平台核实没有这笔转账'}}])
 // 点测发现：同时出现“请检查网络后重试”和“本次内容已锁定”，互相矛盾。结果不确定时只留锁定说明
 assert.equal(vm.uncertain,true);assert.equal(vm.formError,'');assert.ok(vm.editor,'the sheet stays open and locked')
 await vm.submit();assert.equal(calls.length,1,'an uncertain close is never sent a second time from the sheet')
 // A plain refusal from the server is not uncertain: the sheet stays editable and shows the words as they are.
 const refused=panel(async()=>{throw Object.assign(Error('微信刚答复不久，为确保没有还在路上的转账，请约8分钟后再关闭'),{uncertain:false})});refused.module='withdrawals';refused.$nextTick=f=>f()
 refused.editWithdrawal(closable,'close');refused.editor.note='已在商户平台核实没有这笔转账';await refused.submit()
 assert.equal(refused.uncertain,false);assert.equal(refused.formError,'微信刚答复不久，为确保没有还在路上的转账，请约8分钟后再关闭')
}))

test('pendingFilterKeepsClosableRows',()=>{
 const vm=panel(async()=>[]);vm.module='withdrawals';vm.pendingOnly=true
 vm.rows=[{...closable,canQuery:false},{id:58,status:'failed',transfer_state:'FAIL',closedKind:'staff',canClose:false,canQuery:false},{id:59,status:'paid',transfer_state:'SUCCESS'}]
 assert.deepEqual(vm.filtered.map(r=>r.id),[57])
 vm.pendingOnly=false;assert.deepEqual(vm.filtered.map(r=>r.id),[57,58,59])
})

test('reused panel loads the new module and clears the previous editor and filters',async()=>{
 const urls=[],pending=deferred()
 const {vm,stop}=switchingPanel(async url=>{urls.push(url);return url.endsWith('/products')?[{id:1,name:'商品'}]:pending.promise})
 try{
  await vm.refresh()
  Object.assign(vm,{keyword:'商品',pendingOnly:false,limit:75,editor:{title:'编辑商品'},formError:'旧错误',uncertain:true,stockHistory:true,movements:[{id:1}],warehouses:[{id:1}],cashPage:3,cashData:{details:[{reference:'旧收款'}]}})
  vm.module='withdrawals';await nextTick()
  assert.deepEqual(urls,['/staff/manage/products','/staff/manage/withdrawals'])
  assert.equal(vm.loading,true);assert.equal(vm.loaded,false);assert.deepEqual(vm.rows,[])
  assert.equal(vm.editor,null);assert.equal(vm.formError,'');assert.equal(vm.uncertain,false)
  assert.equal(vm.keyword,'');assert.equal(vm.pendingOnly,true);assert.equal(vm.limit,25)
  assert.equal(vm.stockHistory,false);assert.deepEqual(vm.movements,[]);assert.deepEqual(vm.warehouses,[])
  assert.equal(vm.cashPage,1);assert.deepEqual(vm.cashData,{})
  pending.resolve([{...closable}]);await settle()
  assert.equal(vm.loading,false);assert.equal(vm.loaded,true);assert.equal(vm.rows[0].id,57)
 }finally{stop()}
})

test('fast module switches ignore old rows and old access failures without unlocking the current load',async()=>{
 const requests=[]
 const {vm,emitted,stop}=switchingPanel(url=>{const request=deferred();requests.push({url,...request});return request.promise},'stocks')
 try{
  const first=vm.refresh()
  vm.module='members';await nextTick()
  vm.module='withdrawals';await nextTick()
  assert.deepEqual(requests.map(r=>r.url),['/staff/manage/stocks','/staff/manage/members?pendingOnly=true','/staff/manage/withdrawals'])
  requests[0].resolve({stocks:[{id:'old-stock'}],warehouses:[{id:1,enabled:true}]});await first
  requests[1].reject(Error('旧模块已无权限'));await settle()
  assert.equal(vm.loading,true);assert.equal(vm.loaded,false);assert.equal(vm.error,'')
  assert.deepEqual(vm.rows,[]);assert.deepEqual(vm.warehouses,[]);assert.deepEqual(emitted,[])
  requests[2].resolve([{id:57}]);await settle()
  assert.equal(vm.rows[0].id,57);assert.equal(vm.loading,false)
 }finally{stop()}
})

test('cash and list modules can alternate before replies arrive and only the latest cash response commits',async()=>{
 const requests=[]
 const {vm,stop}=switchingPanel(url=>{const request=deferred();requests.push({url,...request});return request.promise},'cash')
 try{
  vm.from='2026-01-01';vm.to='2026-01-31';const first=vm.refresh()
  vm.module='products';await nextTick()
  vm.module='cash';await nextTick()
  assert.equal(requests.length,3);assert.match(requests[0].url,/from=2026-01-01&to=2026-01-31/)
  assert.equal(requests[1].url,'/staff/manage/products');assert.notEqual(requests[2].url,requests[0].url)
  requests[0].resolve({details:[{reference:'old-cash'}],bySource:[{received:999}]});await first
  requests[1].resolve([{id:'old-product'}]);await settle()
  assert.deepEqual(vm.cashData,{});assert.deepEqual(vm.rows,[]);assert.equal(vm.loading,true)
  requests[2].resolve({details:[{reference:'new-cash'}],bySource:[]});await settle()
  assert.equal(vm.cashData.details[0].reference,'new-cash');assert.equal(vm.cashPage,1);assert.equal(vm.loaded,true)
  vm.module='members';await nextTick()
  assert.deepEqual(vm.cashData,{});assert.equal(vm.loaded,false)
  requests[3].resolve([{id:16}]);await settle();assert.equal(vm.rows[0].id,16)
 }finally{stop()}
})

test('module change during an actual write keeps the busy lock until the original request completes',()=>withUni(async()=>{
 const pending=deferred(),calls=[]
 const {vm,emitted,stop}=switchingPanel(async(url,method='GET',body)=>{calls.push({url,method,body});return method==='POST'?pending.promise:[{id:57}]},'stocks')
 try{
  vm.editor={title:'调整可售库存',row:{product_id:8,warehouse_id:2,channel:'B'},delta:'3',note:'盘点增加',requestKey:'same-key'}
  const submitted=vm.submit();await settle()
  assert.equal(calls[0].url,'/staff/manage/stocks');assert.equal(calls[0].method,'POST')
  const editor=vm.editor
  vm.module='withdrawals';await nextTick()
  assert.equal(vm.busy,true);assert.equal(vm.editor,editor);assert.equal(calls.length,1)
  assert.deepEqual(emitted,[['busy',true]])
  await vm.refresh();await vm.submit();assert.equal(calls.length,1,'new reads or writes remain locked')
  pending.resolve({});await submitted;await settle()
  assert.equal(vm.busy,false);assert.equal(vm.editor,null);assert.equal(vm.moduleReloadQueued,false)
  assert.deepEqual(emitted,[['busy',true],['busy',false]])
  assert.equal(calls.length,2);assert.equal(calls[1].url,'/staff/manage/withdrawals');assert.equal(calls[1].method,'GET')
  assert.equal(vm.rows[0].id,57)
 }finally{stop()}
}))

test('changing modules while confirmation is open cannot post the old editor to the new module',async()=>{
 let modal;const calls=[];globalThis.uni={showModal:o=>{modal=o},showToast(){},pageScrollTo(){}}
 const {vm,stop}=switchingPanel(async(url,method='GET')=>{calls.push({url,method});return []},'products')
 try{
  vm.editor={title:'编辑商品',row:{id:9,version:1},name:'护肤商品',spec:'100ml',price:'10',detail:'',enabled:true}
  const submitted=vm.submit();assert.equal(vm.busy,true)
  vm.module='members';await nextTick()
  assert.equal(vm.busy,true);assert.equal(calls.length,0)
  modal.success({confirm:true});await submitted;await settle()
  assert.deepEqual(calls,[{url:'/staff/manage/members?pendingOnly=true',method:'GET'}]);assert.equal(vm.editor,null);assert.equal(vm.busy,false)
 }finally{stop();delete globalThis.uni}
})

test('late withdrawal query failure does not contaminate the next module',async()=>{
 const pending=deferred(),calls=[]
 const {vm,emitted,stop}=switchingPanel(async(url,method='GET')=>{calls.push({url,method});return method==='POST'?pending.promise:[{id:1}]},'withdrawals')
 try{
  const query=vm.queryWithdrawal({id:57});vm.module='products';await nextTick()
  assert.equal(vm.busy,true);assert.equal(calls.length,1)
  pending.reject(Error('旧提现查询权限已变'));await query
  assert.equal(vm.busy,false);assert.equal(vm.error,'');assert.equal(vm.rows[0].id,1)
  assert.deepEqual(emitted,[['busy',true],['busy',false]])
  assert.deepEqual(calls,[{url:'/staff/manage/withdrawals/57',method:'POST'},{url:'/staff/manage/products',method:'GET'}])
 }finally{stop()}
})
