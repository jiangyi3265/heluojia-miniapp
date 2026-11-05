<template>
 <view class="staff-bind">
  <view class="bind-head" @click="toggle"><text class="bind-title">商家绑定</text><text class="bind-more">{{summary}}</text></view>
  <text v-if="loading&&!status" class="bind-hint">正在读取绑定状态…</text>
  <view v-else-if="loadError" class="bind-error" role="alert"><text>{{loadError}}</text><button class="ui-button retry" @click="load">重新读取</button></view>
  <template v-else-if="status&&status.bound">
   <text class="bind-state">已绑定为 {{status.name||'店铺员工'}}{{status.roleLabel?'（'+status.roleLabel+'）':''}}</text>
   <text class="bind-hint">打开小程序会直接进入商家工作台，也可以随时切换到顾客视图。</text>
   <text class="bind-hint">如需解绑，请在管理后台（手机浏览器也可打开）「员工与权限」中操作。</text>
   <button class="ui-button primary" @click="enter">打开商家工作台</button>
  </template>
  <template v-else-if="expanded">
   <template v-if="hasWechat">
    <text class="bind-hint">仅供店铺员工使用。请店长在管理后台（手机浏览器也可打开）「员工与权限」生成绑定码，绑定码30分钟内有效，只能用一次。</text>
    <input class="field code" :value="code" maxlength="12" placeholder="输入8位绑定码" @input="code=$event.detail.value;inputError=''" @blur="code=normalizeBindCode(code)"/>
    <text v-if="inputError" class="bind-error-text" role="alert">{{inputError}}</text>
    <button class="ui-button primary" :loading="busy" :disabled="busy" @click="bind">确认绑定</button>
   </template>
   <text v-else class="bind-hint">商家绑定需要用微信登录的账号。请先在上方「微信登录」里绑定当前微信，再回来输入绑定码。</text>
  </template>
 </view>
</template>
<script>
import {request,getToken} from '../services/shop'
import {fetchStaffMe,openWorkbench} from '../services/staff-entry'
import {normalizeBindCode,bindCodeError} from '../services/staff-workbench'
export default {
 props:{hasWechat:{type:Boolean,default:false},open:{default:false},refreshTick:{default:0}},
 data(){return{status:null,loading:false,loadError:'',expanded:false,code:'',inputError:'',busy:false}},
 computed:{summary(){if(this.status?.bound)return '已绑定';return this.expanded?'收起':'店铺员工使用 ›'}},
 watch:{refreshTick(){this.load()}},
 mounted(){this.expanded=!!this.open&&this.open!=='0';this.load()},
 methods:{
  normalizeBindCode,
  toggle(){if(!this.status?.bound)this.expanded=!this.expanded},
  async load(){
   const token=getToken()
   if(!token||this.loading)return
   this.loading=true;this.loadError=''
   try{const me=await fetchStaffMe();if(token===getToken())this.status=me||{bound:false}}
   catch(e){if(!e.staleSession&&token===getToken())this.loadError='绑定状态暂时读取不到：'+(e.message||'请稍后重试')}
   finally{this.loading=false}
  },
  async bind(){
   if(this.busy)return
   const error=bindCodeError(this.code)
   if(error){this.inputError=error;return}
   const token=getToken(),code=normalizeBindCode(this.code)
   this.busy=true;this.inputError=''
   try{
    const me=await request('/staff/bind','POST',{code})
    if(token!==getToken())return
    this.status=me&&typeof me==='object'?me:{bound:true};this.code=''
    uni.showToast({title:'绑定成功',icon:'success'})
    setTimeout(()=>openWorkbench({replace:true}),700)
   }catch(e){
    if(e.staleSession)return
    this.inputError=e.uncertain?'网络不稳定，暂时不能确认是否绑定成功。请稍后重新打开本页查看，绑定码没用掉可以再试。':(e.message||'绑定没有成功，请重试')
    if(e.uncertain)this.load()
   }finally{this.busy=false}
  },
  enter(){openWorkbench()}
 }
}
</script>
<style scoped>
@import '../styles/component-base.css';
.staff-bind{background:var(--shop-surface, #fdfeff);padding:18px 16px;margin:12px;border:1px solid var(--shop-border, #d5e6ee);border-radius:9px;color:var(--shop-text, #2b424f)}
.bind-head{display:flex;align-items:center;gap:12px}
.bind-title{font-weight:600;font-size:14px}
.bind-more{margin-left:auto;color:var(--shop-muted, #59727f);font-size:12px}
.bind-state{display:block;margin-top:10px;font-size:15px;font-weight:600;color:var(--shop-text, #2b424f);overflow-wrap:anywhere}
.bind-hint{display:block;margin-top:8px;font-size:12px;color:var(--shop-muted, #59727f);line-height:1.8}
.field{width:100%;height:46px;margin-top:12px;padding:0 12px;background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:5px}
.code{font-size:18px;letter-spacing:3px;text-transform:uppercase}
.bind-error-text{display:block;margin-top:8px;font-size:13px;color:#a0552f;line-height:1.7}
.bind-error{margin-top:10px;font-size:13px;color:#875f3d;line-height:1.7}
button{margin:14px 0 0;width:100%;font-size:14px}
button::after{border:0}
.primary{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c)}
.primary[disabled]{background:var(--shop-disabled, #dfebf1)!important;color:var(--shop-muted, #59727f)!important}
.retry{min-height:38px;margin-top:8px;background:#fdf9f4;color:#875f3d}
</style>
