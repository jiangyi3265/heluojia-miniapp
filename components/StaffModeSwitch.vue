<template>
 <view v-if="status?.bound" class="mode-switch" role="navigation" aria-label="商城与管理切换">
  <button role="button" :class="{active:current==='shop'}" :aria-pressed="current==='shop'" :disabled="switching||locked" @click="select('shop')">商城</button>
  <button role="button" :class="{active:current==='manage'}" :aria-pressed="current==='manage'" :disabled="switching||locked" @click="select('manage')">管理</button>
  <text class="role-label">{{status.roleLabel||'店铺员工'}}</text>
 </view>
 <view v-else-if="failed" class="staff-retry" role="alert"><text class="staff-retry-text">管理入口暂时没读取到</text><button role="button" :disabled="switching" @click="refresh">重试</button></view>
</template>
<script>
import {getToken} from '../services/shop'
import {fetchStaffMe,openWorkbench,switchToCustomerView,knownStaff} from '../services/staff-entry'
export default {
 props:{current:{default:'shop'},staff:{default:undefined},locked:{type:Boolean,default:false}},emits:['visibility'],
 data(){return{status:null,switching:false,generation:0,failed:false}},
 watch:{staff:{immediate:true,handler(value){if(value!==undefined){this.status=value;this.$emit('visibility',value?.bound===true)}}}},
 mounted(){if(this.staff===undefined)this.refresh()},beforeUnmount(){this.generation++},
 methods:{
  async refresh(){const generation=++this.generation,token=getToken();this.status=null;this.failed=false;this.$emit('visibility',false);if(!token)return;try{const status=await fetchStaffMe();if(generation!==this.generation||token!==getToken())return;this.status=status;this.$emit('visibility',status?.bound===true)}catch{if(generation===this.generation&&token===getToken()){this.failed=!!knownStaff();this.$emit('visibility',this.failed)}}},
  select(mode){if(this.switching||this.locked||mode===this.current)return;this.switching=true;const complete=()=>{this.switching=false};if(mode==='manage')openWorkbench({replace:true,complete});else switchToCustomerView({complete})}
 }
}
</script>
<style scoped>
.mode-switch{height:44px;padding:5px 16px;display:flex;align-items:center;gap:4px;background:var(--shop-background,#f3f8fb);box-sizing:border-box}
.mode-switch button{margin:0;padding:4px 16px;min-width:72px;height:32px;line-height:24px;font-size:13px;border-radius:16px;background:transparent;color:var(--shop-muted,#59727f)}
.mode-switch button::after{border:0}.staff-retry{height:44px;padding:5px 16px;display:flex;align-items:center;gap:8px;background:var(--shop-background,#f3f8fb);box-sizing:border-box;font-size:13px;color:var(--shop-muted,#59727f)}.staff-retry button{margin:0 0 0 auto;padding:4px 16px;height:32px;line-height:24px;font-size:13px;border-radius:16px;background:var(--shop-accent,#c7e8f5);color:var(--shop-ink,#28546c)}.staff-retry button::after{border:0}
.mode-switch button.active{background:var(--shop-accent,#c7e8f5);color:var(--shop-ink,#28546c);font-weight:600}.role-label{font-size:11px;color:var(--shop-muted,#59727f);margin-left:auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
