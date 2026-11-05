<template>
 <view class="withdrawal-panel">
  <view v-if="error" class="notice error">{{error}}</view>
  <template v-if="mode==='apply'">
   <view class="balance"><text>可提现佣金</text><text class="balance-amount">¥{{money(Math.max(0,distribution.available))}}</text><text class="small">待结算佣金暂不可提现</text></view>
   <WithdrawalRules :distribution="distribution" :rules="feeRules"/>
   <view v-if="!isWechat" class="notice">请进入赫洛嘉微信小程序申请提现并确认收款，这里可以查看提现记录。</view>
   <view v-else-if="!distribution.withdrawalReady" class="notice">{{distribution.withdrawalUnavailableReason||'商家暂未开放微信零钱提现，请稍后再试。'}}</view>
   <view v-if="uncertainIntent" class="form">
    <text class="heading">上一笔申请结果待确认</text><text class="hint">{{pendingLine}}</text>
    <button class="ui-button primary" :loading="busy" :disabled="busy||!isWechat" @click="retry">继续核对这笔申请</button>
   </view>
   <view v-else class="form">
    <text class="form-label">提现金额（元）</text><input v-model="amountText" class="amount-input" type="digit" aria-label="提现金额" placeholder="请输入提现金额" :disabled="busy"/>
    <view class="between"><text class="hint">{{Number(rules.withdrawMinimum)>0?'最低 ¥'+money(rules.withdrawMinimum):'不设提现门槛，到账至少 ¥0.10'}}</text><button class="text-button" :disabled="busy" @click="all">全部提现</button></view>
    <text v-if="maximum>0" class="hint">单笔到账金额最高 ¥{{money(maximum)}}</text>
    <text v-if="amountText&&!valid" class="hint error">{{amountError}}</text>
    <text class="form-label">收款方式</text><text class="block">当前登录微信的零钱账户</text><text class="hint">审核通过后，请在提现记录里点击“确认收款”。</text>
    <template v-if="needsRealName"><text class="form-label">微信实名姓名</text><input v-model="userName" class="name-input" maxlength="40" aria-label="微信实名姓名" placeholder="请填写微信支付实名姓名" :disabled="busy"/><text class="hint">到账金额达到 2,000 元，微信需要核验实名姓名。</text></template>
    <view class="fee-lines"><view class="between"><text>手续费</text><text>¥{{money(rules.withdrawFee)}}</text></view><view v-if="serviceRate>0" class="between"><text>平台服务费（{{taxRateText(serviceRate)}}）</text><text>{{valid?'¥'+money(breakdown.service):'—'}}</text></view><view v-if="taxRate>0" class="between"><text>代扣税费（{{taxRateText(taxRate)}}）</text><text>{{valid?'¥'+money(breakdown.tax):'—'}}</text></view><view class="between"><text>预计到账</text><text class="net-amount">{{expectedReceived===null?'—':'¥'+money(expectedReceived)}}</text></view><text v-if="feeNote" class="hint">{{feeNote}}</text></view>
    <text v-if="distribution.frozen" class="hint error">佣金已被冻结，暂时不能提现{{distribution.frozenReason?'：'+distribution.frozenReason:''}}。如有疑问请联系客服。</text>
    <button class="ui-button primary" :loading="busy" :disabled="busy||!isWechat||!distribution.withdrawalReady||distribution.frozen||!valid||(needsRealName&&!userName.trim())" @click="submit">申请提现到微信零钱</button>
    <text class="hint">提交后先冻结申请金额，财务审核并发起转账。是否到账以微信返回的结果为准。</text>
   </view>
   <button class="ui-button secondary" @click="go('withdrawals')">查看提现记录</button>
   <CommissionNotice :distribution="distribution" :rules="rules"/>
  </template>
  <template v-else>
   <view class="between records-heading"><text class="heading">提现记录</text><button class="text-button" :disabled="busy" @click="$emit('refresh')">刷新</button></view>
   <view v-if="!isWechat" class="notice">待确认的提现，请进入赫洛嘉微信小程序完成收款。</view>
   <view v-if="uncertainIntent" class="notice"><text>有一笔提现提交结果待确认，请先核对。</text><button class="ui-button secondary" @click="go('withdraw')">查看待确认申请</button></view>
   <view v-if="!rows.length" class="empty">还没有提现记录，佣金结算后可以申请。</view>
   <view v-for="row in rows" :key="row.id" class="record">
    <view class="between"><text class="record-amount">¥{{money(row.amount)}}</text><text class="state">{{withdrawalLabel(row)}}</text></view>
    <text class="hint">{{recordLine(row)}}</text>
    <text class="hint">{{formatDate(row.created_at)}}</text><text v-if="row.status==='rejected'&&row.note" class="hint record-note">未通过原因：{{String(row.note).replace(/[。．.；;，,！!？?\s]+$/,'')}}（金额已退回可提现佣金）</text><text v-else-if="row.transfer_note||row.note" class="hint record-note">{{row.transfer_note||row.note}}</text>
    <view v-if="official(row)&&!['SUCCESS','FAIL','CANCELLED'].includes(row.transfer_state)&&row.status!=='rejected'" class="actions">
     <button v-if="['WAIT_USER_CONFIRM','TRANSFERING'].includes(row.transfer_state)&&isWechat" class="ui-button primary" :disabled="busy" :loading="activeId===row.id&&busy" @click="confirm(row)">确认收款</button>
     <button v-if="row.transfer_state!=='CREATED'" class="ui-button secondary" :disabled="busy" @click="check(row)">查询到账结果</button>
    </view>
   </view>
  </template>
 </view>
</template>
<script>
import {money,go,notify} from '../services/shop'
import {formatDate} from '../services/display'
import CommissionNotice from './CommissionNotice.vue'
import WithdrawalRules from './WithdrawalRules.vue'
import {createWithdrawal,reconcileWithdrawalIntent,queryWithdrawal,confirmWithdrawal,withdrawalLabel} from '../services/wechat-withdrawal'
import {taxRateText,distributorServiceRate,withdrawalBreakdown,withdrawalFeeNote,withdrawalAmountProblem,previewReceived,largestWithdrawal,withdrawalRecordAmounts,withdrawalReleased,withdrawalPaid} from '../services/withdrawal-amount'
export default {
 components:{CommissionNotice,WithdrawalRules},
 props:{mode:{default:'apply'},distribution:{type:Object,default:()=>({})},rules:{type:Object,default:()=>({})}},emits:['refresh'],
 data(){return{amountText:'',userName:'',busy:false,error:'',activeId:0,isWechat:false,uncertainIntent:null}},
 computed:{rows(){return this.distribution.withdrawals||[]},amount(){return Math.round(Number(this.amountText)*100)},feeRules(){return {...this.rules,distributorServiceRate:distributorServiceRate(this.rules,this.distribution)}},breakdown(){return withdrawalBreakdown(Number.isSafeInteger(this.amount)?this.amount:0,this.feeRules)},taxRate(){return this.breakdown.rate},serviceRate(){return this.breakdown.serviceRate},feeNote(){return withdrawalFeeNote(this.feeRules)},netAmount(){return Math.max(0,this.breakdown.net)},maximum(){return Number(this.distribution.withdrawalMaxAmount||0)},
  // WeChat asks for the payee's real name from 2,000 元 received. The shop's per-withdrawal cap (经营设置, at most 1,999.99 元) comes
  // from the server; an amount above it cannot be submitted, so the name box stays hidden instead of appearing next to the over-cap message.
  needsRealName(){return this.netAmount>=200000&&!(this.maximum>0&&this.netAmount>this.maximum)},
  amountError(){if(!/^[0-9]+(\.[0-9]{1,2})?$/.test(String(this.amountText)))return '请输入金额，最多保留两位小数';return withdrawalAmountProblem(this.amount,{rules:this.feeRules,available:this.distribution.available,maximum:this.maximum})},valid(){return !!this.amountText&&Number.isSafeInteger(this.amount)&&!this.amountError},
  // Exactly the 预计到账 shown above; sent with the request so the server can refuse it if its own amount has changed.
  expectedReceived(){return this.valid?previewReceived(this.amount,{rules:this.feeRules,available:this.distribution.available,maximum:this.maximum}):null},
  pendingLine(){const p=this.uncertainIntent;return p?'提现金额 ¥'+money(p.amount)+(Number.isSafeInteger(p.expectedReceived)?'，预计到账 ¥'+money(p.expectedReceived):'')+'。继续核对会使用同一笔申请，不会重复扣减佣金。':''}},
 watch:{rows:{immediate:true,handler(rows){try{this.uncertainIntent=reconcileWithdrawalIntent(rows)}catch{this.uncertainIntent=null}}}},
 mounted(){
  // #ifdef MP-WEIXIN
  this.isWechat=true
  // #endif
 },
 methods:{money,go,formatDate,withdrawalLabel,taxRateText,official(row){return row.withdrawal_channel==='wechat'||row.payment_mode==='wechat_transfer'},recordLine(row){const a=withdrawalRecordAmounts(row);if(withdrawalReleased(row))return '没有扣手续费和税费，申请的 ¥'+money(a.amount)+' 已全部退回可提现佣金';return '手续费 ¥'+money(a.fee)+(a.service>0?' · 平台服务费 ¥'+money(a.service)+(a.serviceRate>0?'（'+taxRateText(a.serviceRate)+'）':''):'')+(a.tax>0?' · 代扣税费 ¥'+money(a.tax)+(a.rate>0?'（'+taxRateText(a.rate)+'）':''):'')+' · '+(withdrawalPaid(row)?'实际到账':'预计到账')+' ¥'+money(a.received)},all(){this.amountText=money(largestWithdrawal({available:this.distribution.available,rules:this.feeRules,maximum:this.maximum}))},async run(fn,id=0){if(this.busy)return;this.busy=true;this.activeId=id;this.error='';try{await fn()}catch(e){this.error=e.message;notify(e)}finally{try{this.uncertainIntent=reconcileWithdrawalIntent(this.rows)}catch{}this.$emit('refresh');this.busy=false;this.activeId=0}},
  // When the server says the amounts changed, the typed amount stays in the box (a retry puts its own amount there) and run() reloads
  // the rules and balance, so the new 预计到账 shows for the same amount. A retry resends its stored 预计到账, never the current one.
  async submit(){const expected=this.expectedReceived,amount=this.amount,name=this.needsRealName?this.userName:'';if(!this.isWechat||!this.distribution.withdrawalReady||!this.valid||expected===null)return;await this.run(async()=>{await createWithdrawal(amount,name,expected);go('withdrawals')})},
  async retry(){if(!this.isWechat||!this.uncertainIntent)return;const pending=this.uncertainIntent;await this.run(async()=>{try{await createWithdrawal(pending.amount,pending.userName||'',pending.expectedReceived)}catch(e){if(e.amountsChanged){this.amountText=money(pending.amount);this.userName=pending.userName||''}throw e}go('withdrawals')})},async check(row){await this.run(async()=>{const result=await queryWithdrawal(row.id);notify(withdrawalLabel(result.withdrawal||row))},row.id)},async confirm(row){if(!this.isWechat)return;await this.run(async()=>{const result=await confirmWithdrawal(row.id);notify(result.withdrawal?.transfer_state==='SUCCESS'?'已确认到账，请查看微信零钱':'确认结果正在同步，请稍后查询到账结果')},row.id)}}
}
</script>
<style scoped>
@import '../styles/component-base.css';
.withdrawal-panel{padding:14px;font-size:14px;color:var(--shop-text, #2b424f);line-height:1.7}.balance{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);padding:22px;border-radius:12px}.balance-amount{display:block;font-size:32px;font-weight:600;margin:6px 0}.small{font-size:12px}.notice{padding:14px 16px;background:var(--shop-background, #f3f8fb);border-radius:8px;margin:12px 0}.error{color:#a23d32}.form,.record{background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px;padding:18px;margin:14px 0}.form-label{display:block;font-weight:600;margin:20px 0 8px}.form-label:first-child{margin-top:0}.amount-input,.name-input{width:100%;padding:4px 12px;background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:7px}.amount-input{font-size:24px;height:56px}.hint{display:block;color:var(--shop-muted, #59727f);font-size:12px;line-height:1.8}.hint.error{color:#a23d32}.between{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}.between>text{overflow-wrap:anywhere}.text-button{background:transparent;color:var(--shop-ink, #28546c);font-size:13px;padding:6px;margin:0;line-height:1.7;white-space:nowrap}.text-button::after{border:0}.fee-lines{border-top:1px solid var(--shop-border, #d5e6ee);margin-top:20px;padding-top:12px}.fee-lines .between{padding:5px 0}.net-amount,.record-amount{font-size:20px;font-weight:600}.primary{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);margin:14px 0 10px}.secondary{background:var(--shop-background, #f3f8fb);color:var(--shop-ink, #28546c);border:1px solid var(--shop-border, #d5e6ee)}.heading{font-size:17px;font-weight:600}.block{display:block}.records-heading{margin:4px 0 14px}.state{font-size:13px;text-align:right}.record-note{margin-top:8px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.actions .ui-button{flex:1;min-width:130px;margin:0}.empty{padding:40px 18px;text-align:center;color:var(--shop-muted, #59727f)}button[disabled]{opacity:.55}
</style>
