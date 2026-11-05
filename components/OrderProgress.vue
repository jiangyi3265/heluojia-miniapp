<template>
 <view class="progress-card">
  <view v-if="statusTitle" class="progress-status"><text class="status-eyebrow">订单状态</text><text class="status-title">{{statusTitle}}</text><text v-if="statusHint" class="status-hint">{{statusHint}}</text></view>
  <view class="progress-content">
  <view class="progress-heading"><text>订单流转</text><text class="progress-refresh" @click="$emit('refresh')">刷新</text></view>
  <view v-if="error" class="progress-error"><text>{{error}}</text><text @click="$emit('refresh')">点击重试</text></view>
  <text v-else-if="loading&&!events.length" class="progress-empty">正在读取订单记录…</text>
  <text v-else-if="!events.length" class="progress-empty">暂无流转记录</text>
  <view v-for="(event,index) in visibleEvents" :key="event.id" class="progress-row" :class="{latest:index===0}">
   <view class="progress-rail"><view class="progress-dot"/><view v-if="index<visibleEvents.length-1" class="progress-line"/></view>
   <view class="progress-body"><text class="progress-title">{{event.title}}</text><text class="progress-time">{{date(event.time)}}</text><text v-if="event.detail" class="progress-detail">{{event.detail}}</text></view>
  </view>
  <view v-if="events.length>2" class="progress-expand" @click="expanded=!expanded">{{expanded?'收起记录':'查看全部 '+events.length+' 条记录'}} {{expanded?'⌃':'⌄'}}</view>
  </view>
 </view>
</template>
<script>
import {request,getToken} from '../services/shop'
import {formatDate} from '../services/display'
import {refreshOnTick} from '../services/panel-refresh'
export default {
 emits:['refresh'],mixins:[refreshOnTick()],props:{orderId:{type:[Number,String],required:true},statusTitle:{type:String,default:''},statusHint:{type:String,default:''}},
 data(){return {events:[],loading:false,error:'',sequence:0,expanded:false}},
 computed:{visibleEvents(){return (this.expanded?this.events:this.events.slice(-2)).slice().reverse()}},
 watch:{orderId(){this.events=[];this.expanded=false;this.load()}},mounted(){this.load()},
 methods:{date:formatDate,async load(){
  const sequence=++this.sequence,token=getToken(),id=this.orderId;this.loading=true;this.error='';
  try{const events=await request('/orders/'+encodeURIComponent(id)+'/progress');if(this._panelRefreshDisposed||sequence!==this.sequence||token!==getToken()||id!==this.orderId)return;this.events=events}
  catch(e){if(!this._panelRefreshDisposed&&sequence===this.sequence){this.events=[];if(!e.staleSession)this.error=e.message||'订单记录暂时无法读取'}}
  finally{if(sequence===this.sequence)this.loading=false}
 }}
}
</script>
<style scoped>
@import '../styles/component-base.css';

.progress-card{box-sizing:border-box;margin:12px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:14px;overflow:hidden}.progress-status{padding:20px 20px 18px;background:linear-gradient(120deg,var(--shop-soft, #eaf5fb),var(--shop-background, #f3f8fb))}.status-eyebrow{display:block;font-size:12px;letter-spacing:1px;color:var(--shop-muted, #59727f);margin-bottom:7px}.status-title{display:block;font-size:25px;font-weight:600;line-height:1.4;color:var(--shop-text, #2b424f)}.status-hint{display:block;font-size:13px;line-height:1.8;color:var(--shop-muted, #59727f);margin-top:7px}.progress-content{padding:18px 20px 4px}.progress-heading{display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:600;color:var(--shop-ink, #28546c);margin-bottom:18px}.progress-refresh{font-size:12px;font-weight:400;color:var(--shop-muted, #59727f);padding:4px 0 4px 16px}.progress-row{display:flex;min-height:62px}.progress-rail{width:18px;flex-shrink:0;position:relative}.progress-dot{position:relative;z-index:1;width:7px;height:7px;margin-top:7px;background:var(--shop-accent, #c7e8f5);border-radius:50%}.progress-line{position:absolute;top:14px;bottom:-7px;left:3px;width:1px;background:var(--shop-soft, #eaf5fb)}.progress-body{flex:1;min-width:0;padding:0 0 17px 7px}.progress-title,.progress-time,.progress-detail{display:block;line-height:1.65;overflow-wrap:anywhere}.progress-title{font-size:14px;color:var(--shop-muted, #59727f)}.progress-time{font-size:12px;color:var(--shop-muted, #59727f);margin-top:2px}.progress-detail{font-size:12px;color:var(--shop-muted, #59727f);margin-top:3px}.latest .progress-dot{background:var(--shop-control, #417c9a);box-shadow:0 0 0 4px var(--shop-soft, #eaf5fb)}.latest .progress-title{color:var(--shop-ink, #28546c);font-weight:600}.progress-error{display:flex;flex-direction:column;gap:10px;font-size:13px;color:#8b5940;padding-bottom:16px}.progress-empty{display:block;font-size:13px;color:var(--shop-muted, #59727f);padding-bottom:18px}.progress-expand{text-align:center;font-size:13px;color:var(--shop-muted, #59727f);line-height:1.6;padding:10px 0 14px;border-top:1px solid var(--shop-border, #d5e6ee)}
</style>
