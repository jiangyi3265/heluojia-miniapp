<template>
 <view class="main-tabbar" role="navigation" aria-label="主导航">
  <button v-for="tab in tabs" :key="tab.page" role="button" :class="{selected:active===tab.page}" :aria-label="tab.title" :aria-current="active===tab.page?'page':undefined" :disabled="navigating" @click="select(tab.page)">
   <view class="main-tab-icon"><UiIcon :name="tab.icon" :active="active===tab.page" :size="23"/><text v-if="tab.page==='cart'&&cartQuantity>0" class="main-tab-badge">{{cartQuantity>99?'99+':cartQuantity}}</text></view>
   <text>{{tab.title}}</text>
  </button>
 </view>
</template>
<script>
import UiIcon from './UiIcon.vue'
export default {
 components:{UiIcon},
 props:{active:{type:String,required:true},cartQuantity:{type:Number,default:0}},
 emits:['reselect'],
 data(){return{navigating:false,tabs:[{page:'skincare',title:'首页',icon:'home'},{page:'index',title:'商城',icon:'bag'},{page:'category',title:'分类',icon:'grid'},{page:'cart',title:'购物车',icon:'cart'},{page:'me',title:'我的',icon:'user'}]}},
 methods:{select(page){if(this.navigating)return;if(page===this.active){this.$emit('reselect');return}this.navigating=true;uni.reLaunch({url:'/pages/'+page+'/index',complete:()=>{this.navigating=false}})}}
}
</script>
<style scoped>
.main-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;align-items:flex-start;max-width:430px;height:calc(57px + env(safe-area-inset-bottom));padding:0 5px env(safe-area-inset-bottom);margin:0 auto;box-sizing:border-box;border-top:1px solid var(--shop-border, #d5e6ee);background:var(--shop-background, #f3f8fb);font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif}
.main-tabbar button{flex:1;min-width:0;height:56px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;padding:4px 0;margin:0;border:0;border-radius:0;background:transparent;color:var(--shop-muted, #59727f);font-size:11px;font-weight:400;line-height:1.4;box-sizing:border-box}
.main-tabbar button:after{border:0}.main-tabbar button.selected{color:var(--shop-ink, #28546c);font-weight:600}.main-tabbar button:active{opacity:.7}.main-tabbar button:focus-visible{outline:2px solid var(--shop-control, #417c9a);outline-offset:-4px}.main-tab-icon{position:relative;display:flex;height:23px}.main-tab-badge{position:absolute;top:-4px;left:16px;min-width:15px;height:15px;padding:0 4px;box-sizing:border-box;border-radius:10px;background:#a84e42;color:#fdf9f5;font-size:9px;line-height:15px;text-align:center}
</style>
