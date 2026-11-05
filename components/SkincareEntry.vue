<template>
 <view class="skincare-entry">
  <button role="button" class="skincare-entry-link" @click="go('skincare')" aria-label="探索赫洛嘉专属护肤方案">
   <view class="entry-copy"><text class="entry-kicker">HELUOJIA · 为你而选</text><text class="entry-title">你的肤感，你的护肤方案</text><text class="entry-note">了解护理偏好，找到日常方案</text><text class="entry-action">开始定制 <text>↗</text></text></view>
   <image class="entry-image" src="/static/skincare/hero.jpg" mode="aspectFill"/>
  </button>
 </view>
</template>
<script>
import {go} from '../services/shop.js'
export default {methods:{go}}
</script>
<style scoped>
.skincare-entry{margin:20px 16px 4px}.skincare-entry-link{position:relative;display:flex;align-items:center;width:100%;min-height:178px;margin:0;padding:23px 18px;box-sizing:border-box;overflow:hidden;border-radius:12px;background:var(--shop-soft, #eaf5fb);color:var(--shop-text, #2b424f);text-align:left;line-height:1.5}.skincare-entry-link:after{border:0}.entry-copy{position:relative;z-index:1;width:72%;pointer-events:none}.entry-kicker{display:block;font-size:9px;letter-spacing:1.4px;color:var(--shop-ink, #28546c)}.entry-title{display:block;font-size:18px;font-weight:600;letter-spacing:-.5px;margin-top:8px}.entry-note{display:block;font-size:12px;color:var(--shop-muted, #59727f);margin-top:6px}.entry-action{display:inline-flex;align-items:center;gap:18px;margin-top:18px;padding:7px 14px;background:var(--shop-border, #d5e6ee);border-radius:30px;font-size:12px}.entry-action text{font-size:17px;line-height:16px}.entry-image{position:absolute;right:-13px;top:0;width:41%;height:100%;mix-blend-mode:multiply;opacity:.9}.skincare-entry-link:active{opacity:.82}@media(max-width:360px){.entry-title{font-size:16px}.entry-copy{width:75%}}
</style>
