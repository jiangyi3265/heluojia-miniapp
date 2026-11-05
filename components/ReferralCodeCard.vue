<template>
 <view v-if="code" class="referral-card">
  <text class="referral-title">我的推广邀请码</text>
  <view class="referral-code-row"><text selectable user-select class="referral-code">{{code}}</text><button class="ui-button" :disabled="copying" @click="copy">{{copying?'复制中':'复制邀请码'}}</button></view>
  <CopyFallback :value="copyFallback" :busy="copying" @retry="copy" @close="copyFallback=''"/>
  <text class="referral-hint">用于确认你的推广来源。分享商品或邀请伙伴时，会自动带上你的编号。</text>
  <view class="referral-footer" @click="go('promo-materials')"><text>查看我的推广素材</text><text>›</text></view>
 </view>
</template>
<script>
import {promotionCode} from '../services/invitations'
import {go} from '../services/shop'
import {copyText} from '../services/clipboard'
import CopyFallback from './CopyFallback.vue'
export default {components:{CopyFallback},props:{member:{type:Object,default:null}},data(){return{copyFallback:'',copying:false}},computed:{code(){return promotionCode(this.member)}},watch:{code(){this.copyFallback=''}},methods:{go,async copy(){if(this.copying)return;this.copying=true;try{return await copyText(this.code,{successText:'邀请码已复制',onFallback:text=>{this.copyFallback=text}})}finally{this.copying=false}}}}
</script>
<style scoped>
@import '../styles/component-base.css';

.referral-card{box-sizing:border-box;margin:12px;padding:18px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:12px;color:var(--shop-text, #2b424f)}.referral-title{display:block;font-size:17px;font-weight:600;line-height:1.5}.referral-code-row{display:flex;gap:14px;align-items:center;justify-content:space-between;margin:14px 0}.referral-code{min-width:0;font-size:26px;font-weight:600;letter-spacing:2px;overflow-wrap:anywhere}.referral-code-row button{flex-shrink:0;margin:0;padding:9px 12px;font-size:14px;line-height:1.5;border-radius:7px;background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}.referral-code-row button::after{border:0}.referral-hint{display:block;font-size:13px;line-height:1.8;color:var(--shop-muted, #59727f)}.referral-footer{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--shop-border, #d5e6ee);font-size:14px;line-height:1.6}
</style>
