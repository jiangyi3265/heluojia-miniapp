import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../services/wechat-withdrawal.js',import.meta.url),'utf8').replace("import {request,getToken} from './shop'",'').replaceAll('export ','')
function fixture(request,native=options=>options.success({})){const storage=new Map([['shop-owner',123]]);let token='customer-a',nativeCalls=0;const uni={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k)},wx={canIUse:()=>true,getAccountInfoSync:()=>({miniProgram:{appId:'wx-test'}}),requestMerchantTransfer:options=>{nativeCalls++;native(options)}};return{...new Function('request','getToken','uni','wx',source+';return {createWithdrawal,reconcileWithdrawalIntent,confirmWithdrawal,withdrawalLabel,amountsChanged,AMOUNTS_CHANGED_MESSAGE}')(request,()=>token,uni,wx),storage,wx,changeAccount:()=>{token='customer-b'},nativeCalls:()=>nativeCalls}}
const pending={withdrawal:{id:8,transfer_state:'WAIT_USER_CONFIRM'},confirm:{mchId:'merchant-test',appId:'wx-test',package:'opaque-package'}}
test('lost response and retry preserve exact withdrawal intent and block changed amounts',async()=>{const calls=[];let fail=true;const f=fixture(async(path,method,body)=>{calls.push(body);if(fail)throw Object.assign(Error('timeout'),{uncertain:true});return {withdrawal:{id:8}}});await assert.rejects(()=>f.createWithdrawal(10000));await assert.rejects(()=>f.createWithdrawal(12000),/上一笔/);assert.equal(calls.length,1);fail=false;await f.createWithdrawal(10000);assert.deepEqual(calls[0],calls[1]);assert.equal('account' in calls[0],false);assert.equal('openid' in calls[0],false);assert.equal(f.storage.has('shop-withdrawal-intent-123'),false)})
test('record refresh reconciles only the same account request key',()=>{const f=fixture(async()=>{});f.storage.set('shop-withdrawal-intent-123',{amount:10000,requestKey:'same'});assert.ok(f.reconcileWithdrawalIntent([{request_key:'other'}]));assert.equal(f.reconcileWithdrawalIntent([{request_key:'same'}]),null)})
test('native success does not fabricate a paid state',async()=>{let calls=0;const f=fixture(async()=>{calls++;return pending});const result=await f.confirmWithdrawal(8);assert.equal(calls,2);assert.equal(f.nativeCalls(),1);assert.equal(result.withdrawal.transfer_state,'WAIT_USER_CONFIRM')})
test('server SUCCESS skips native confirmation',async()=>{const f=fixture(async()=>({withdrawal:{transfer_state:'SUCCESS'}}));assert.equal((await f.confirmWithdrawal(8)).withdrawal.transfer_state,'SUCCESS');assert.equal(f.nativeCalls(),0)})
test('native cancellation still checks actual transfer success',async()=>{let calls=0;const f=fixture(async()=>++calls===1?pending:{withdrawal:{transfer_state:'SUCCESS'}},options=>options.fail({errMsg:'requestMerchantTransfer:cancel'}));assert.equal((await f.confirmWithdrawal(8)).withdrawal.transfer_state,'SUCCESS');assert.equal(calls,2)})
test('a stale login never opens confirmation for a different user',async()=>{let f;f=fixture(async()=>{f.changeAccount();return pending});await assert.rejects(()=>f.confirmWithdrawal(8),/登录状态/);assert.equal(f.nativeCalls(),0)})
test('unsupported WeChat and mismatched app id fail before native confirmation',async()=>{let f=fixture(async()=>pending);f.wx.canIUse=()=>false;await assert.rejects(()=>f.confirmWithdrawal(8),/新版微信/);assert.equal(f.nativeCalls(),0);f=fixture(async()=>({...pending,confirm:{...pending.confirm,appId:'another-app'}}));await assert.rejects(()=>f.confirmWithdrawal(8),/参数/);assert.equal(f.nativeCalls(),0)})
test('failure to query after confirmation remains uncertain',async()=>{let calls=0;const f=fixture(async()=>{if(++calls===1)return pending;throw Error('offline')});await assert.rejects(()=>f.confirmWithdrawal(8),e=>e.uncertain&&/待确认/.test(e.message))})
test('rejection label overrides stale initial transfer state',()=>{const f=fixture(async()=>{});assert.equal(f.withdrawalLabel({status:'rejected',transfer_state:'CREATED'}),'已驳回，金额已释放')})
test('TRANSFERING can recover confirmation only with server-provided parameters',async()=>{const state={...pending,withdrawal:{transfer_state:'TRANSFERING'}};let f=fixture(async()=>state);await f.confirmWithdrawal(8);assert.equal(f.nativeCalls(),1);f=fixture(async()=>({withdrawal:state.withdrawal}));await f.confirmWithdrawal(8);assert.equal(f.nativeCalls(),0)})

// A stand-in for ShopWechatWithdrawal.request(): an existing request key is answered with its withdrawal after comparing only
// amount and receiver name; expectedReceived is checked only when a new withdrawal would be created.
function fakeServer(){
 const server={net:7900,records:[],sent:[],lose:null}
 server.request=async(path,method,body)=>{
  server.sent.push(JSON.parse(JSON.stringify(body)))
  if(server.lose==='before'){server.lose=null;throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})}
  let record=server.records.find(r=>r.requestKey===body.requestKey)
  if(record){if(record.amount!==body.amount||record.userName!==(body.userName||''))throw Object.assign(Error('同一次提现不能修改金额或收款身份，请核对已有申请'),{uncertain:false})}
  else{
   if(body.expectedReceived!==undefined&&body.expectedReceived!==null&&String(body.expectedReceived).trim()!==''&&body.expectedReceived!==server.net)throw Object.assign(Error('到账金额有调整，请刷新后重新确认'),{uncertain:false})
   record={id:server.records.length+1,requestKey:body.requestKey,amount:body.amount,userName:body.userName||'',received:server.net};server.records.push(record)
  }
  if(server.lose==='after'){server.lose=null;throw Object.assign(Error('无法连接服务，请检查网络后重试'),{uncertain:true})}
  return {withdrawal:{id:record.id,received_amount:record.received}}
 }
 return server
}
test('the shown 预计到账 is sent as expectedReceived in whole 分, and left out when it is not one',async()=>{
 const server=fakeServer(),f=fixture(server.request)
 await f.createWithdrawal(10000,'',7900);assert.equal(server.sent[0].expectedReceived,7900);assert.equal(server.sent[0].amount,10000)
 for(const value of [undefined,null,'7900',79.5,-1,Number.NaN]){await f.createWithdrawal(10000,'',value).catch(()=>{});assert.equal('expectedReceived' in server.sent.at(-1),false,String(value))}
})
test('amounts changed on the server: nothing is kept, the message is plain, and the next submission uses a new key',async()=>{
 const server=fakeServer(),f=fixture(server.request);server.net=7800
 const error=await f.createWithdrawal(10000,'',7900).catch(e=>e)
 assert.equal(error.amountsChanged,true);assert.equal(error.message,'到账金额有调整，已为你更新预计到账，请核对后重新提交');assert.equal(error.uncertain,undefined)
 assert.equal(f.storage.has('shop-withdrawal-intent-123'),false);assert.equal(server.records.length,0)
 await f.createWithdrawal(10000,'',7800)
 assert.notEqual(server.sent[1].requestKey,server.sent[0].requestKey);assert.equal(server.sent[1].expectedReceived,7800);assert.equal(server.records[0].received,7800)
})
test('a lost response retried after the fee changed resends the same key and 预计到账 and gets the same withdrawal back',async()=>{
 const server=fakeServer(),f=fixture(server.request);server.lose='after'
 await assert.rejects(()=>f.createWithdrawal(10000,'',7900),e=>e.uncertain)
 server.net=7800 // the platform service fee was switched on after the request reached the server
 // the page now previews 78.00: that is a different submission and must wait for the pending one
 await assert.rejects(()=>f.createWithdrawal(10000,'',7800),/上一笔/);assert.equal(server.sent.length,1)
 const pending=f.reconcileWithdrawalIntent([]);assert.equal(pending.expectedReceived,7900)
 const result=await f.createWithdrawal(pending.amount,pending.userName||'',pending.expectedReceived)
 assert.deepEqual(server.sent[1],server.sent[0]);assert.equal(result.withdrawal.id,1);assert.equal(server.records.length,1);assert.equal(server.records[0].received,7900)
 assert.equal(f.storage.has('shop-withdrawal-intent-123'),false)
})
test('a request that never arrived, retried after the fee changed, is refused and frees the key for a fresh submission',async()=>{
 const server=fakeServer(),f=fixture(server.request);server.lose='before'
 await assert.rejects(()=>f.createWithdrawal(10000,'',7900),e=>e.uncertain);assert.equal(f.storage.get('shop-withdrawal-intent-123').expectedReceived,7900)
 server.net=7800
 const pending=f.reconcileWithdrawalIntent([])
 await assert.rejects(()=>f.createWithdrawal(pending.amount,pending.userName||'',pending.expectedReceived),e=>e.amountsChanged)
 assert.deepEqual(server.sent[1],server.sent[0]);assert.equal(server.records.length,0);assert.equal(f.reconcileWithdrawalIntent([]),null)
 await f.createWithdrawal(10000,'',7800);assert.notEqual(server.sent[2].requestKey,server.sent[0].requestKey);assert.equal(server.records[0].received,7800)
})
test('a pending request saved by the previous app version is retried unchanged, without a 预计到账',async()=>{
 const server=fakeServer(),f=fixture(server.request);f.storage.set('shop-withdrawal-intent-123',{amount:10000,requestKey:'wd_saved_before_update'})
 await assert.rejects(()=>f.createWithdrawal(10000,'',7900),/上一笔/);assert.equal(server.sent.length,0)
 const pending=f.reconcileWithdrawalIntent([]);await f.createWithdrawal(pending.amount,pending.userName||'',pending.expectedReceived)
 assert.deepEqual(server.sent[0],{amount:10000,requestKey:'wd_saved_before_update'})
})
test('only a definite refusal about the amount counts as amounts changed',()=>{
 const f=fixture(async()=>{})
 assert.equal(f.amountsChanged(Object.assign(Error('到账金额有调整，请刷新后重新确认'),{uncertain:false})),true)
 assert.equal(f.amountsChanged(Object.assign(Error('到账金额有调整，请刷新后重新确认'),{uncertain:true})),false)
 assert.equal(f.amountsChanged(Object.assign(Error('到账金额有调整，请刷新后重新确认'),{staleSession:true})),false)
 assert.equal(f.amountsChanged(Error('可提现余额不足')),false);assert.equal(f.amountsChanged(undefined),false)
})
