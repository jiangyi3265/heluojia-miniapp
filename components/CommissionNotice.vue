<template>
 <view class="commission-notice">
  <text class="notice-title">{{guidance.title}}</text>
  <text v-if="guidance.debt" class="notice-copy">{{guidance.debt}}</text>
  <view v-if="guidance.breakdown.length" class="pending-lines">
   <view v-for="row in guidance.breakdown" :key="row.key" class="pending-line"><text>{{row.label}}</text><text class="pending-amount">¥{{money(row.amount)}}</text></view>
  </view>
  <text class="notice-copy">{{guidance.settlement}}</text>
  <text class="notice-copy threshold">{{guidance.threshold}}</text>
  <text v-if="guidance.reserved" class="notice-copy">{{guidance.reserved}}</text>
  <text class="notice-footnote">待结算金额暂不计入可提现余额；退款或售后可能影响结算。</text>
 </view>
</template>
<script>
import {money} from '../services/shop'
import {withdrawalGuidance} from '../services/withdrawal-guidance'
export default {
 props:{distribution:{type:Object,default:()=>({})},rules:{type:Object,default:()=>({})}},
 computed:{guidance(){return withdrawalGuidance(this.distribution,this.rules)}},methods:{money}
}
</script>
<style scoped>
@import '../styles/component-base.css';
.commission-notice{margin:14px 0;padding:16px;background:var(--shop-background, #f3f8fb);background:oklch(97% .008 140);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px;color:var(--shop-text, #2b424f);font-size:13px;line-height:1.75;overflow-wrap:anywhere}
.notice-title{display:block;font-size:16px;font-weight:600;line-height:1.5;margin-bottom:8px}.notice-copy{display:block;margin-top:8px}.pending-lines{padding:4px 0 8px;border-bottom:1px solid var(--shop-border, #d5e6ee)}.pending-line{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:3px 0}.pending-line>text:first-child{min-width:0}.pending-amount{font-weight:600;white-space:nowrap;flex-shrink:0;font-variant-numeric:tabular-nums}.threshold{font-weight:600}.notice-footnote{display:block;margin-top:10px;color:var(--shop-ink, #28546c);font-size:12px;line-height:1.7}
</style>
