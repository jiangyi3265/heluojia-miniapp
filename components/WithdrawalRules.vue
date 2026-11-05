<template>
 <view class="withdrawal-rules">
  <text class="rules-title">提现规则</text>
  <view v-for="row in rows" :key="row.key" class="rule-row">
   <text class="rule-label">{{row.label}}</text>
   <text class="rule-copy">{{row.text}}</text>
  </view>
 </view>
</template>
<script>
import {withdrawalRuleRows} from '../services/withdrawal-guidance'
export default {
 props:{distribution:{type:Object,default:()=>({})},rules:{type:Object,default:()=>({})}},
 computed:{rows(){return withdrawalRuleRows(this.distribution,this.rules)}}
}
</script>
<style scoped>
@import '../styles/component-base.css';
.withdrawal-rules{margin:18px 0 22px;color:var(--shop-text, #2b424f);line-height:1.75;overflow-wrap:anywhere}
.rules-title{display:block;margin-bottom:12px;font-size:17px;font-weight:600;color:var(--shop-ink, #28546c)}
.rule-row{display:flex;align-items:baseline;gap:12px;padding:10px 0;border-bottom:1px solid var(--shop-border, #d5e6ee)}
.rule-row:last-child{border-bottom:0;padding-bottom:0}
.rule-label{flex:0 0 84px;font-size:13px;font-weight:600}
.rule-copy{flex:1;min-width:0;font-size:13px}
@media(max-width:350px){.rule-row{display:block;padding:12px 0}.rule-label{display:block;margin-bottom:4px}.rule-copy{display:block}}
</style>
