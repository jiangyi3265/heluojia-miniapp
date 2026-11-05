<template>
 <view class="coupon-wallet">
  <view class="heading">我的优惠券</view>
  <view v-if="error" class="card">{{error}}<button class="ui-button" @click="load">重新加载</button></view>
  <view v-if="!loading&&!owned.length" class="card muted">还没有优惠券，可以在下面领取。</view>
  <view v-for="c in owned" :key="c.id" class="card" :class="{muted:c.display_state!=='available'}">
   <view class="between"><text>{{c.name}}</text><text class="amount">减 ¥{{money(c.discount_amount)}}</text></view>
   <view>满 ¥{{money(c.threshold_amount)}} 可用 · {{scope(c)}}</view><view class="small">{{c.display_state==='terminated'?'商家已终止使用，此券不能再抵扣或退款返还':c.return_on_refund===0||c.return_on_refund===false?'使用后退款不返券':'整单退款且未过期时返券；部分退款不返'}}</view>
   <view class="small">{{states[c.display_state]||c.display_state}} · 有效至 {{date(c.expires_at)}}</view>
   <button class="ui-button" v-if="c.display_state==='available'" @click="home()">去选商品</button>
  </view>
  <view class="heading">可以领取</view>
  <view v-if="!loading&&!campaigns.length" class="card muted">暂时没有领券活动。</view>
  <view v-for="c in campaigns" :key="c.id" class="card">
   <view class="between"><text>{{c.name}}</text><text class="amount">减 ¥{{money(c.discount_amount)}}</text></view>
   <view>满 ¥{{money(c.threshold_amount)}} 可用 · {{scope(c)}}</view><view class="small">{{c.return_on_refund===0||c.return_on_refund===false?'使用后退款不返券':'整单退款且未过期时返券；部分退款不返'}}</view>
   <view class="small">领后{{c.valid_days}}天有效 · 每人限领{{c.claim_limit}}张{{c.audience==='new'?' · 新客户专享':''}}</view>
   <button class="ui-button" :disabled="busy||claimCount(c)>=c.claim_limit" @click="claim(c)">{{claimCount(c)>=c.claim_limit?'已领取':'领取优惠券'}}</button>
  </view>
 </view>
</template>
<script>
import {request,money,home,notify,go,getToken} from '../services/shop.js'
export default {
 props:{refreshTick:{default:0}},watch:{refreshTick(){this.load()}},data(){return {owned:[],campaigns:[],loading:false,busy:false,error:'',keys:{},states:{available:'可使用',reserved:'订单待付款，暂时占用',used:'已使用',expired:'已过期',terminated:'已终止'}}},
 mounted(){this.load()},
 methods:{money,home,date(v){return String(v||'').slice(0,10)},scope(c){try{return JSON.parse(c.product_ids).length?'指定商品可用':'零售商品通用'}catch{return '指定商品可用'}},claimCount(c){return this.owned.filter(x=>x.campaign_id===c.id).length},
 async load(){this.loading=true;this.error='';try{this.campaigns=await request('/coupon-campaigns');this.owned=getToken()?await request('/coupons'):[]}catch(e){this.error=e.message}finally{this.loading=false}},
 async claim(c){if(!getToken())return go('login');if(this.busy)return;this.busy=true;try{const key=this.keys[c.id]||(this.keys[c.id]='claim_'+Date.now()+'_'+Math.random().toString(36).slice(2));await request('/coupon-campaigns/'+c.id+'/claim','POST',{requestKey:key});delete this.keys[c.id];await this.load();uni.showToast({title:'已放入你的券包',icon:'success'})}catch(e){notify(e)}finally{this.busy=false}}
 }
}
</script>
<style scoped>
@import '../styles/component-base.css';

.coupon-wallet{padding:16px}.heading{font-size:20px;font-weight:600;margin:16px 0}.card{padding:18px;margin-bottom:14px;background:var(--shop-surface, #fdfeff);border-radius:12px;line-height:1.8;font-size:16px}.between{display:flex;justify-content:space-between;gap:12px}.amount{color:#ab552e;white-space:nowrap}.small{font-size:14px;color:var(--shop-ink, #28546c)}.muted{color:var(--shop-muted, #59727f)}button{margin-top:12px;background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);font-size:16px}button[disabled]{background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}
</style>
