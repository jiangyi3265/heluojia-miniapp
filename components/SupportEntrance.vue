<template><view class="support-entry"><view v-if="error" class="error" @click="load">{{error}} · 点击重试</view><view v-else-if="config" class="support-card"><UiIcon name="message" :size="42"/><text class="title">{{config.name||'联系店铺客服'}}</text><text v-if="config.hours" class="hours">{{config.hours}}</text><template v-if="config.mode==='qr'"><image class="qr" :src="asset(config.qr,960)" mode="aspectFit" show-menu-by-longpress @click="preview"/><text class="hint">点击查看二维码，长按识别或保存</text><button class="ui-button" @click="preview">查看客服二维码</button></template><template v-else><button class="ui-button" v-if="isWechat" open-type="contact" :show-message-card="true" send-message-title="商城咨询">联系微信客服</button><text v-else class="hint">请在微信小程序内点击客服入口</text></template></view></view></template>
<script>
import {request,asset} from '../services/shop.js'
import UiIcon from './UiIcon.vue'
export default {components:{UiIcon},props:{refreshTick:{default:0}},data(){return{config:null,error:'',isWechat:false}},mounted(){
 // #ifdef MP-WEIXIN
 this.isWechat=true
 // #endif
 this.load()
},watch:{refreshTick(){this.load()}},methods:{asset,async load(){try{this.config=(await request('/storefront')).support;this.error=''}catch(e){this.error=e.message}},preview(){if(this.config?.qr)uni.previewImage({urls:[asset(this.config.qr,960)]})}}}
</script>
<style scoped>
@import '../styles/component-base.css';
.support-entry{padding:24px 16px}.support-card{padding:32px 24px;background:var(--shop-surface, #fdfeff);border-radius:16px;display:flex;flex-direction:column;align-items:center;text-align:center;color:var(--shop-text, #2b424f)}.title{font-size:22px;font-weight:600;margin:18px 0 10px}.hours,.hint{color:var(--shop-muted, #59727f);font-size:13px;line-height:1.7}.qr{width:220px;height:220px;margin:20px 0}.support-card button{width:100%;margin:24px 0 0;line-height:46px;font-size:16px;border-radius:10px;background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c)}.error{color:#985738}</style>
