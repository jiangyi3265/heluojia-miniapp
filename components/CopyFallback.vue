<template>
 <view v-if="value" class="copy-overlay" @click="$emit('close')">
  <view class="copy-panel" @click.stop>
   <text class="copy-title">手动复制</text>
   <text class="copy-hint">自动复制未成功，请长按下面的文字，选择复制。</text>
   <scroll-view scroll-y class="copy-scroll" :style="{height:Math.min(260,Math.max(80,Math.ceil(value.length/22)*24))+'px'}">
    <text selectable user-select class="copy-text">{{value}}</text>
   </scroll-view>
   <view class="copy-actions"><button class="ui-button" @click="$emit('close')">关闭</button><button class="ui-button" :disabled="busy" @click="$emit('retry')">{{busy?'复制中':'重新复制'}}</button></view>
  </view>
 </view>
</template>
<script>
export default {props:{value:{type:String,default:''},busy:{type:Boolean,default:false}},emits:['retry','close']}
</script>
<style scoped>
@import '../styles/component-base.css';
.copy-overlay{position:fixed;inset:0;z-index:1000;background:rgba(25,42,31,.45);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;color:var(--shop-text, #2b424f)}.copy-panel{box-sizing:border-box;width:100%;max-width:520px;background:var(--shop-surface, #fdfeff);border-radius:14px;padding:20px}.copy-title{display:block;font-size:18px;font-weight:600}.copy-hint{display:block;margin:10px 0;color:var(--shop-ink, #28546c);font-size:13px;line-height:1.7}.copy-scroll{max-height:42vh;background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:6px;box-sizing:border-box}.copy-text{display:block;padding:12px;font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;user-select:text;-webkit-user-select:text}.copy-actions{display:flex;gap:12px;margin-top:18px}.copy-actions button{flex:1;margin:0;font-size:14px;line-height:40px;background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}.copy-actions button:last-child{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c)}.copy-actions button[disabled]{background:var(--shop-soft, #eaf5fb);color:var(--shop-muted, #59727f)}
</style>
