<template><ShopScreen v-if="resolved" ref="screen" screen="order-detail" :query="query"/><view v-else class="order-link"><text class="title">订单详情</text><text class="message">{{resolving?'正在查找订单…':linkError}}</text><button v-if="loginRequired" @click="login">微信登录后查看</button><button v-else-if="!resolving" @click="resolveLink">重新加载</button><button v-if="!resolving" class="secondary" @click="openOrders">查看订单列表</button></view></template>
<script>
import ShopScreen from '../../components/ShopScreen.vue'
import {resolveWechatOrderLink} from '../../services/wechat-order-link'
import {go} from '../../services/shop'
export default {
 components:{ShopScreen},
 data(){return {query:{},shown:false,resolved:false,resolving:false,externalOrderNo:'',linkError:'',loginRequired:false,linkSequence:0}},
 onLoad(q){if(Object.prototype.hasOwnProperty.call(q,'orderNo'))this.externalOrderNo=q.orderNo;else{this.query=q;this.resolved=true}},
 onShow(){if(!this.resolved){this.resolveLink();return}this.$nextTick(()=>{if(this.shown)this.$refs.screen?.refresh();this.shown=true;this.$refs.screen?.resume()})},
 onHide(){this.cancelLink();this.$refs.screen?.suspend()},
 onUnload(){this.cancelLink();this.$refs.screen?.suspend()},
 async onPullDownRefresh(){try{if(this.resolved)await this.$refs.screen?.refresh();else await this.resolveLink()}finally{uni.stopPullDownRefresh()}},
 methods:{
  async resolveLink(){
   if(this.resolving||this.resolved)return
   const sequence=++this.linkSequence;this.resolving=true;this.loginRequired=false;this.linkError=''
   try{const query=await resolveWechatOrderLink(this.externalOrderNo);if(sequence!==this.linkSequence)return;this.query=query;this.resolved=true;this.shown=true}
   catch(e){if(sequence!==this.linkSequence)return;this.loginRequired=!!e.loginRequired;this.linkError=e.message||'订单暂时无法加载，请重试'}
   finally{if(sequence===this.linkSequence)this.resolving=false}
  },
  cancelLink(){this.linkSequence++;this.resolving=false},
  login(){uni.setStorageSync('shop-return',{screen:'order-detail',query:{orderNo:this.externalOrderNo}});uni.redirectTo({url:'/pages/login/index'})},
  openOrders(){go('orders')}
 }
}
</script>
<style scoped>.order-link{min-height:60vh;padding:90rpx 40rpx;text-align:center;background:var(--shop-background, #f3f8fb);color:var(--shop-text, #2b424f)}.title{display:block;font-size:38rpx;font-weight:600}.message{display:block;margin:50rpx 0;line-height:1.7;color:var(--shop-ink, #28546c)}.order-link button{margin:24rpx 0;background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);font-size:30rpx}.order-link .secondary{background:var(--shop-surface, #fdfeff);color:var(--shop-ink, #28546c)}</style>
