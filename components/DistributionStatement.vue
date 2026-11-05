<template>
 <view class="statement">
  <view class="intro"><text class="title">月度结算单</text><text class="hint">按月汇总你的佣金和提现，方便每月核对收入。金额以商城记录为准。</text></view>
  <picker mode="selector" :range="choices" range-key="label" :value="choiceIndex" @change="pickMonth">
   <view class="month-picker"><view><text class="hint">结算月份</text><text class="month">{{monthLabel(month)}}</text></view><text class="switch">切换月份 ›</text></view>
  </picker>
  <view v-if="error" class="error" role="alert"><text>{{error}}</text><button class="ui-button" :disabled="loading" @click="load">重新加载</button></view>
  <view v-if="loading&&!statement" class="loading">正在整理 {{monthLabel(month)}} 的结算单…</view>
  <template v-if="statement">
   <view class="section">
    <text class="section-title">佣金</text>
    <view class="line"><view class="label"><text>本月产生佣金</text><text class="hint">客户付款后记到你名下的佣金</text></view><text class="value">¥{{money(s.commissionGenerated)}}</text></view>
    <view class="line"><view class="label"><text>退款扣回</text><text class="hint">客户退款或售后后，按规则扣回的佣金</text></view><text class="value minus">−¥{{money(s.commissionClawedBack)}}</text></view>
    <view class="line total"><text>本月佣金合计</text><text class="value">{{s.commissionNet<0?'−':''}}¥{{money(Math.abs(s.commissionNet))}}</text></view>
    <text class="hint">佣金要等订单收货并过了结算期才能提现，所以本月产生的佣金不一定在本月提现。</text>
   </view>
   <view class="section">
    <view class="between"><text class="section-title">提现</text><text class="hint">本月到账 {{s.withdrawals}} 笔</text></view>
    <view class="line"><view class="label"><text>提现申请金额</text><text class="hint">本月已转入微信零钱的提现，按申请金额合计</text></view><text class="value">¥{{money(s.withdrawnGross)}}</text></view>
    <view class="line"><view class="label"><text>手续费</text><text class="hint">每笔提现按商家规定收取</text></view><text class="value minus">−¥{{money(s.withdrawFee)}}</text></view>
    <view class="line"><view class="label"><text>平台服务费{{serviceRate?'（'+rateText(serviceRate)+'）':''}}</text><text class="hint">{{serviceNote}}</text></view><text class="value minus">−¥{{money(s.serviceFee)}}</text></view>
    <view class="line"><view class="label"><text>代扣税费</text><text class="hint">{{s.taxWithheld>0?'按提现申请金额代扣，由公司代为申报缴纳':'本月没有代扣税费'}}</text></view><text class="value minus">−¥{{money(s.taxWithheld)}}</text></view>
    <view class="line total"><text>实际到账</text><text class="value">¥{{money(s.netPaid)}}</text></view>
    <text class="hint">实际到账 = 提现申请金额 − 手续费 − 平台服务费 − 代扣税费，已转入你的微信零钱。</text>
   </view>
   <view class="note"><text>客户付款时产生的支付手续费由商家承担，不从你的佣金里扣。</text></view>
   <view class="section">
    <text class="section-title">佣金变动明细</text>
    <view v-for="e in statement.events" :key="e.id" class="record">
     <view class="between"><text>{{e.delta>0?'佣金产生':'退款扣回'}}</text><text class="value" :class="{minus:e.delta<0}">{{e.delta>0?'+':'−'}}¥{{money(Math.abs(e.delta))}}</text></view>
     <text v-if="e.note" class="hint">{{e.note}}</text><text class="hint">{{e.orderNo?'订单 '+e.orderNo+(e.at?' · ':''):''}}{{formatDate(e.at)}}</text>
    </view>
    <text v-if="!statement.events.length" class="empty">这个月没有佣金变动</text>
   </view>
   <view class="section">
    <text class="section-title">提现明细</text>
    <view v-for="w in statement.withdrawals" :key="w.id" class="record">
     <view class="between"><text>申请 ¥{{money(w.amount)}}</text><text class="state">{{stateLabel(w.state)}}</text></view>
     <text class="hint">手续费 ¥{{money(w.fee)}} · 平台服务费 ¥{{money(w.service)}}{{w.serviceRate>0?'（'+rateText(w.serviceRate)+'）':''}} · 代扣税费 ¥{{money(w.tax)}}</text>
     <view class="between"><text class="hint">{{formatDate(w.at)}}</text><text class="received">到账 ¥{{money(w.received)}}</text></view>
    </view>
    <text v-if="!statement.withdrawals.length" class="empty">这个月没有到账的提现</text>
   </view>
   <button class="ui-button secondary" @click="go('withdrawals')">查看全部提现记录</button>
  </template>
 </view>
</template>
<script>
import {request,money,go,getToken} from '../services/shop'
import {formatDate} from '../services/display'
import {rateText} from '../services/withdrawal-amount'
import {monthOf,monthLabel,monthChoices,readStatement,statementHasRecords,statementServiceRate,serviceFeeExplanation,statementError} from '../services/distribution-statement'
export default {
 props:{refreshTick:{default:0},rules:{type:Object,default:()=>({})}},
 data(){return{month:monthOf(),statement:null,serverMonths:[],checkedMonths:{},checkedFor:'',loading:false,error:'',reloadQueued:false}},
 computed:{
  s(){return this.statement?.summary||{}},
  choices(){return monthChoices(this.serverMonths,new Date(),this.checkedMonths)},
  choiceIndex(){return Math.max(0,this.choices.findIndex(c=>c.month===this.month))},
  serviceRate(){return this.statement?statementServiceRate(this.statement,this.rules):null},
  serviceNote(){return serviceFeeExplanation(this.serviceRate)}
 },
 watch:{refreshTick(){this.load()}},mounted(){this.load()},
 methods:{money,go,formatDate,monthLabel,rateText,
  stateLabel(state){return ({paid:'已到账',pending:'处理中',unknown:'结果待核实',rejected:'已驳回',failed:'未到账，金额已退回'})[state]||(state?'处理中':'已到账')},
  pickMonth(event){const choice=this.choices[Number(event?.detail?.value)];if(!choice||choice.month===this.month)return;this.month=choice.month;this.statement=null;this.error='';this.load()},
  async load(){
   if(this.loading){this.reloadQueued=true;return}
   const token=getToken(),month=this.month
   this.loading=true;this.error=''
   try{
    const data=await request('/distribution/statements?month='+encodeURIComponent(month))
    if(token!==getToken()||month!==this.month)return
    const statement=readStatement(data,month)
    this.statement=statement;if(statement.months.length)this.serverMonths=statement.months
    // The month list always includes this month; mark a month as having records only from what its statement shows.
    if(this.checkedFor!==token){this.checkedFor=token;this.checkedMonths={}}
    this.checkedMonths={...this.checkedMonths,[month]:statementHasRecords(statement)}
   }catch(e){if(!e.staleSession&&token===getToken()&&month===this.month){this.error=statementError(e);this.statement=null}}
   finally{this.loading=false;if(this.reloadQueued||month!==this.month){this.reloadQueued=false;this.load()}}
  }
 }
}
</script>
<style scoped>
@import '../styles/component-base.css';
.statement{padding:16px 14px 28px;color:var(--shop-text, #2b424f);font-size:14px}.intro{padding:8px 2px 14px}.title{display:block;font-size:22px;font-weight:600;line-height:1.5}.hint{display:block;font-size:12px;line-height:1.8;color:var(--shop-muted, #59727f);overflow-wrap:anywhere}.intro>.hint{margin-top:6px}
.month-picker{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);border-radius:12px;padding:16px 18px;margin-bottom:14px}.month-picker .hint{color:var(--shop-ink, #28546c)}.month{display:block;font-size:20px;font-weight:600;line-height:1.5}.switch{font-size:13px;white-space:nowrap}
.section{background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px;padding:16px;margin-bottom:14px}.section-title{display:block;font-size:16px;font-weight:600;line-height:1.5;margin-bottom:4px}.between{display:flex;justify-content:space-between;align-items:center;gap:12px}
.line{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px solid var(--shop-border, #d5e6ee)}.line:last-child{border-bottom:0}.label{flex:1;min-width:0}.value{white-space:nowrap;flex-shrink:0;font-variant-numeric:tabular-nums;font-weight:600}.minus{color:#985e37}.total{border-bottom:0;font-size:16px;font-weight:600}.total .value{font-size:18px;color:var(--shop-ink, #28546c)}
.section.line{padding:16px}.note{padding:12px 16px;background:var(--shop-background, #f3f8fb);border-radius:8px;margin-bottom:14px;font-size:13px;line-height:1.8;color:var(--shop-text, #2b424f)}
.record{padding:12px 0;border-bottom:1px solid var(--shop-border, #d5e6ee)}.record:last-of-type{border-bottom:0}.state{font-size:12px;color:var(--shop-ink, #28546c);white-space:nowrap}.received{font-size:13px;font-weight:600;color:var(--shop-ink, #28546c);white-space:nowrap}
.empty{display:block;text-align:center;color:var(--shop-muted, #59727f);font-size:13px;padding:18px 8px}.loading{display:block;color:var(--shop-muted, #59727f);text-align:center;font-size:13px;padding:22px 8px}
.error{padding:14px;background:#faf0e7;color:#875f3d;font-size:14px;line-height:1.8;border-radius:8px;margin-bottom:14px}.error>button{background:#fdf9f4;color:#875f3d;margin-top:10px}
.secondary{background:var(--shop-background, #f3f8fb);color:var(--shop-ink, #28546c);border:1px solid var(--shop-border, #d5e6ee);width:100%}
</style>
