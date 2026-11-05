import {request,getToken} from './shop'

function intentKey(){
 const owner=uni.getStorageSync('shop-owner')||uni.getStorageSync('shop-member')?.id
 if(!owner||!getToken())throw Error('请先登录')
 return 'shop-withdrawal-intent-'+owner
}

// The server's answer when the 预计到账 sent as expectedReceived no longer equals what it would transfer
// (手续费、代扣税费或平台服务费 changed after the page loaded). Nothing was created, so the request key is free again.
export function amountsChanged(e){return !!e&&!e.uncertain&&!e.staleSession&&/到账金额有调整/.test(e.message||'')}
export const AMOUNTS_CHANGED_MESSAGE='到账金额有调整，已为你更新预计到账，请核对后重新提交'

// Keep an uncertain submission across retries and page/app restarts.
// expectedReceived: the 预计到账 in 分 the page showed; left out when not a whole number of 分 (older stored intents have none).
// A retry resends the stored body unchanged, same requestKey and same expectedReceived. For a key it already has, the server
// returns that withdrawal after comparing only amount and receiver; it checks expectedReceived only when it creates a new one.
// So a changed preview never rides on an old key: it is a different submission and waits until the pending one is resolved.
export async function createWithdrawal(amount,userName='',expectedReceived){
 const key=intentKey(),stored=uni.getStorageSync(key),expected=Number.isSafeInteger(expectedReceived)&&expectedReceived>=0?expectedReceived:undefined
 const body=stored||{amount,requestKey:'wd_'+Date.now()+'_'+Math.random().toString(36).slice(2,12),...(userName.trim()?{userName:userName.trim()}:{}),...(expected===undefined?{}:{expectedReceived:expected})}
 if(stored&&(body.amount!==amount||(body.userName||'')!==userName.trim()||body.expectedReceived!==expected))throw Error('上一笔提现提交结果待确认，请先继续核对该笔申请')
 uni.setStorageSync(key,body)
 try{const result=await request('/withdrawals','POST',body);uni.removeStorageSync(key);return result}
 catch(e){
  if(!e.uncertain&&!e.staleSession)uni.removeStorageSync(key)
  if(amountsChanged(e))throw Object.assign(Error(AMOUNTS_CHANGED_MESSAGE),{amountsChanged:true})
  throw e
 }
}

export function reconcileWithdrawalIntent(rows=[]){
 const key=intentKey(),body=uni.getStorageSync(key)
 if(!body)return null
 if(rows.some(row=>(row.request_key||row.requestKey)===body.requestKey)){uni.removeStorageSync(key);return null}
 return body
}

export function withdrawalLabel(row){
 if(row.status==='paid'&&row.payment_mode!=='wechat_transfer'&&row.withdrawal_channel!=='wechat')return '历史已处理'
 const transfer={CREATED:'待财务审核',QUEUED:'已审核，待转账',ACCEPTED:'微信已受理',PROCESSING:'微信转账中',WAIT_USER_CONFIRM:'请确认收款',TRANSFERING:'微信转账中',SUCCESS:'已到账',FAIL:'转账失败，金额已释放',CANCELING:'撤销处理中',CANCELLED:'转账已关闭，金额已释放',UNKNOWN:'结果待核实'}
 if(row.status==='rejected')return '已驳回，金额已释放'
 if(row.transfer_state)return transfer[row.transfer_state]||'结果待核实'
 return {pending:'待审核',paid:'已到账',failed:'转账失败，金额已释放',unknown:'结果待核实，请勿重复申请'}[row.status]||'请联系客服核实'
}

export function queryWithdrawal(id){return request('/withdrawals/'+id+'/wechat-status','POST',{})}

// Native success only means the confirmation page opened, never that money arrived.
export async function confirmWithdrawal(id){
 const token=getToken(),current=()=>{if(token!==getToken())throw Object.assign(Error('登录状态已变化，请重新查看提现记录'),{staleSession:true})}
 if(typeof wx==='undefined'||typeof wx.requestMerchantTransfer!=='function'||!wx.canIUse?.('requestMerchantTransfer'))throw Error('请在新版微信小程序中确认收款')
 const before=await queryWithdrawal(id);current()
 if(before.withdrawal?.transfer_state==='SUCCESS')return before
 if(!['WAIT_USER_CONFIRM','TRANSFERING'].includes(before.withdrawal?.transfer_state)||!before.confirm)return before
 const {mchId,appId,package:packageInfo}=before.confirm
 if(!mchId||!appId||!packageInfo||wx.getAccountInfoSync?.().miniProgram?.appId!==appId)throw Error('收款参数未能核对，请刷新提现记录后重试')
 let failure
 try{await new Promise((resolve,reject)=>wx.requestMerchantTransfer({mchId,appId,package:packageInfo,success:resolve,fail:reject}))}catch(e){failure=e}
 current()
 let after
 try{after=await queryWithdrawal(id)}catch(e){current();throw Object.assign(Error('收款结果待确认，请刷新该笔提现记录，不要重复申请'),{uncertain:true})}
 current()
 if(after.withdrawal?.transfer_state==='SUCCESS')return after
 if(failure&&/cancel/i.test(failure.errMsg||''))throw Error('尚未确认收款，可以在这笔提现记录中继续确认')
 if(failure)throw Error('未能打开微信收款页面，请稍后从这笔记录重试')
 return after
}
