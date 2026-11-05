<template>
 <view class="module-panel settings">
  <template v-if="!editor">
   <view class="panel-heading"><view><text class="panel-title">{{info.title}}</text><text class="hint">{{info.hint}}</text></view><button class="small-button" :disabled="loading||busy" @click="refresh">刷新</button></view>
   <text v-if="loaded&&!canEdit" class="notice-block">你可以查看这些设置；需要修改请联系店长。</text>
   <text v-if="notice" class="notice-block">{{notice}}</text>
   <text v-if="error" class="error" role="alert">{{error}}</text>
   <view v-if="loading&&!loaded" class="empty">正在读取…</view>
   <view v-else-if="!loaded" class="empty">数据尚未读取成功，请点击上方刷新重试。</view>
   <template v-else>
    <view class="record settings-withdrawal">
     <text class="record-title">提现规则</text>
     <view class="line"><text>最低提现金额</text><text class="strong">{{Number(w.withdrawMinimum)===0?'不设门槛':money(w.withdrawMinimum)}}</text></view>
     <view class="line"><text>每笔提现手续费</text><text class="strong">{{money(w.withdrawFee)}}</text></view>
     <view class="line"><text>提现代扣比例</text><text class="strong">{{w.withdrawTaxRate>0?percentText(w.withdrawTaxRate):'不代扣'}}</text></view>
     <view class="line"><text>处理时限</text><text class="strong">申请后 {{w.withdrawWorkingDays}} 个工作日内</text></view>
     <view class="line"><text>单笔提现最多到账</text><text class="strong">{{money(w.withdrawMaxAmount)}}</text></view>
     <text class="hint">{{notes.max}}</text>
     <text class="hint">{{example}}</text>
     <text v-if="outOfStep" class="notice-block">{{outOfStep}}</text>
     <button v-if="canEdit" class="small-button action" :disabled="busy||loading" @click="openWithdrawal">修改提现规则</button>
    </view>
    <view class="record settings-service">
     <text class="record-title">分销商平台服务费</text>
     <view class="line"><text>分销商平台服务费</text><text class="strong">{{percentText(rate)}}</text></view>
     <text class="hint">{{notes.service}}</text>
     <text class="hint">{{serviceExample}}</text>
     <button v-if="canEdit" class="small-button action" :disabled="busy||loading" @click="openService">修改服务费</button>
    </view>
    <view class="record settings-delivery">
     <text class="record-title">配送与自提</text>
     <view class="line"><text>配送方式</text><text class="strong">{{methodsOn||'未开启'}}</text></view>
     <text v-if="methodsOff" class="hint">未开启：{{methodsOff}}</text>
     <text class="section-label">运费规则</text>
     <text v-for="r in d.rules||[]" :key="'r'+r.index" class="hint">{{ruleTitle(r)}}：{{ruleFeeText(r)}}</text>
     <text v-if="!(d.rules&&d.rules.length)" class="hint">还没有运费规则</text>
     <text class="section-label">自提门店</text>
     <view v-for="p in d.points||[]" :key="p.id" class="point">
      <text class="strong">{{p.name}}</text>
      <text class="hint">{{p.address}}</text>
      <text class="hint">营业时间：{{p.hours||'未填写'}}</text>
      <text class="hint" :class="{'warn-note':!p.warehouseEnabled}">备货仓库：{{pointWarehouseText(p)}}</text>
      <text v-if="p.pendingPickups>0" class="hint">待自提订单 {{p.pendingPickups}} 笔</text>
     </view>
     <text v-if="!(d.points&&d.points.length)" class="hint">还没有自提门店</text>
     <text class="hint notice-line">给顾客看的配送说明：{{d.notice||'未填写'}}（在电脑后台修改）</text>
     <button v-if="canEdit" class="small-button action" :disabled="busy||loading" @click="openDelivery">修改配送与自提</button>
    </view>
   </template>
  </template>

  <view v-else class="editor">
   <button class="text-button" :disabled="busy" @click="closeEditor">‹ 返回</button>
   <text class="editor-title">{{editor.title}}</text>

   <template v-if="editor.kind==='withdrawal'">
    <text class="label">最低提现金额（元）</text><input type="digit" v-model="editor.form.withdrawMinimum" :disabled="locked"/><text class="hint">填 0 表示不设商家提现门槛；扣费后的到账金额仍须至少 ¥0.10。</text>
    <text class="label">每笔提现手续费（元）</text><input type="digit" v-model="editor.form.withdrawFee" :disabled="locked"/>
    <text class="label">提现代扣比例（%）</text><input type="digit" v-model="editor.form.withdrawTaxRate" :disabled="locked"/>
    <text class="hint">{{notes.tax}}</text>
    <text class="label">申请后几个工作日内处理</text><input type="number" v-model="editor.form.withdrawWorkingDays" :disabled="locked"/>
    <text class="hint">{{notes.days}}</text>
    <text class="label">单笔提现最多到账（元）</text><input type="digit" v-model="editor.form.withdrawMaxAmount" :disabled="locked"/>
    <text class="hint">{{notes.max}}</text>
    <text v-if="editorExample" class="hint">{{editorExample}}</text>
   </template>

   <template v-if="editor.kind==='service'">
    <text class="label">比例（%）</text><input type="digit" v-model="editor.percent" :disabled="locked" placeholder="0 到 50，例如 1"/>
    <text class="hint">{{notes.service}}</text>
   </template>

   <template v-if="editor.kind==='delivery'">
    <text class="section-label">配送方式</text>
    <view v-for="m in deliveryMethods" :key="m[0]">
     <view class="switch-line"><text>{{m[1]}}</text><switch :checked="editor.form.methods[m[0]]" color="#73afcb" :disabled="locked||(!editor.form.methods[m[0]]&&m[0]!=='pickup'&&!hasRule(m[0]))" @change="editor.form.methods[m[0]]=$event.detail.value"/></view>
     <text v-if="m[0]!=='pickup'&&!hasRule(m[0])" class="hint">还没有运费规则，请先在电脑后台添加</text>
    </view>
    <text class="section-label">运费</text>
    <view v-for="r in editor.form.rules" :key="'e'+r.index" class="record">
     <text class="record-title">{{r.title}}</text>
     <text class="hint">首 {{r.first}} 件，每续 {{r.next}} 件（件数和地区在电脑后台修改）</text>
     <view class="pair"><view><text class="label">首件运费（元）</text><input type="digit" v-model="r.firstFee" :disabled="locked"/></view><view><text class="label">续件运费（元）</text><input type="digit" v-model="r.nextFee" :disabled="locked"/></view></view>
     <view class="pair"><view><text class="label">偏远附加费（元）</text><input type="digit" v-model="r.remoteFee" :disabled="locked"/></view><view><text class="label">满额包邮（元）</text><input type="digit" v-model="r.freeAmount" :disabled="locked"/></view></view>
     <text class="hint">满额包邮填 0 表示不包邮。</text>
    </view>
    <text class="section-label">自提门店</text>
    <view v-for="(p,i) in editor.form.points" :key="p.key" class="record store-editor">
     <text class="label">门店名称</text><input v-model="p.name" maxlength="80" :disabled="locked"/>
     <text class="label">详细地址</text><textarea v-model="p.address" maxlength="400" auto-height :disabled="locked"/>
     <text class="label">营业时间（选填）</text><input v-model="p.hours" maxlength="80" placeholder="如 每天 9:00-21:00" :disabled="locked"/>
     <text class="label">备货仓库</text>
     <picker :range="warehouses" range-key="name" :value="warehouseIndex(p)" :disabled="locked" @change="pickWarehouse(p,$event)"><view class="picker">{{warehouseName(p)||'请选择仓库'}} ›</view></picker>
     <text v-if="p.pendingPickups>0" class="hint">有 {{p.pendingPickups}} 笔待自提订单</text>
     <button class="small-button action" :disabled="locked" @click="removePoint(i)">删除这家门店</button>
    </view>
    <button class="secondary" :disabled="locked" @click="addPoint">添加门店</button>
   </template>

   <text v-if="formError" class="error" role="alert">{{formError}}</text>
   <text v-if="uncertain" class="notice">{{notes.uncertain}}</text>
   <button class="primary" :loading="busy" :disabled="busy||uncertain" @click="submit">{{uncertain?'请先核对最新设置':'确认保存'}}</button>
   <button v-if="uncertain" class="secondary" :disabled="busy" @click="reloadLatest">返回并核对最新设置</button>
   <button v-if="stale" class="secondary" :disabled="busy" @click="reloadLatest">读取最新设置后再改</button>
  </view>
 </view>
</template>
<script>
import {request,getToken} from '../../../services/shop'
import {MANAGEMENT_MODULES} from '../services/staff-management'
import {money,percentText,WITHDRAWAL_FIELDS,valueText,withdrawalForm,readWithdrawalForm,withdrawalNotice,withdrawalExampleText,withdrawalFormExample,withdrawalConfirmText,WITHDRAW_MAX_NOTE,TAX_NOTE,DAYS_NOTE,SERVICE_NOTE,rateToPercentInput,readServiceRate,serviceConfirmText,DELIVERY_METHODS,methodLabel,ruleTitle,ruleFeeText,pointWarehouseText,deliveryForm,newPointKey,readDeliveryForm,deliveryConfirmText,removePointConfirmText,afterSaveMismatch,SETTINGS_UNCERTAIN,STALE_SETTINGS} from '../services/staff-settings'
const ACCESS=/绑定|权限|无权|登录/
const ask=(title,content,confirmText)=>new Promise(resolve=>uni.showModal({title,content,confirmText,cancelText:'再看看',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))
export default {
 props:{module:{required:true},me:{required:true}},
 emits:['access-change','busy'],
 data(){return{data:null,base:null,loaded:false,loading:false,error:'',sequence:0,editor:null,formError:'',uncertain:false,stale:false,busy:false,notice:''}},
 computed:{
  info(){return MANAGEMENT_MODULES.find(m=>m.key===this.module)||{}},
  notes(){return {max:WITHDRAW_MAX_NOTE,tax:TAX_NOTE,days:DAYS_NOTE,service:SERVICE_NOTE,uncertain:SETTINGS_UNCERTAIN}},
  deliveryMethods(){return DELIVERY_METHODS},
  canEdit(){return this.me.canEditShopSettings===true&&this.data?.canEdit===true},
  w(){return this.data?.withdrawal?.values||{}},
  rate(){return this.data?.serviceFee?.distributorServiceRate},
  d(){return this.data?.delivery||{}},
  example(){return withdrawalExampleText(this.w,this.rate)},
  outOfStep(){return withdrawalNotice(this.w)},
  serviceExample(){return '举例：提现 ¥100.00 扣 '+money(Math.floor(10000*(Number(this.rate)||0)/10000))+'。'},
  editorExample(){return this.editor?.kind==='withdrawal'?withdrawalFormExample(this.editor.form,this.editor.base?.serviceFee?.distributorServiceRate):''},
  methodsOn(){return (this.d.methods||[]).map(methodLabel).join('、')},
  methodsOff(){return DELIVERY_METHODS.filter(([k])=>!(this.d.methods||[]).includes(k)).map(m=>m[1]).join('、')},
  // 编辑时只用打开时的那份设置（editor.base）：刷新晚到也不会让仓库列表、比较的原值和提交的原值在编辑途中变掉。
  warehouses(){return (this.editor?this.editor.base:this.data)?.delivery?.warehouses||[]},
  locked(){return this.busy||this.uncertain}
 },
 mounted(){this.load()},
 beforeUnmount(){this.sequence++},
 methods:{
  money,percentText,ruleTitle,ruleFeeText,pointWarehouseText,
  hasRule(k){return (this.editor?.base?.delivery?.rules||[]).some(r=>(r.method||'express')===k)},
  refresh(){if(this.busy||this.editor)return;return this.load()},
  // Returns true only when fresh settings were read. An open editor keeps its own copy of the values it was opened with (editor.base),
  // so an answer that arrives after it opened only changes the page behind it, never what the editor compares with or sends.
  async load(){
   const seq=++this.sequence;this.loading=true;this.error=''
   try{const r=await request('/staff/manage/settings');if(seq!==this.sequence)return false;this.data=r;this.base=JSON.parse(JSON.stringify(r));this.loaded=true;return true}
   catch(e){if(seq===this.sequence)this.fail(e);return false}
   finally{if(seq===this.sequence)this.loading=false}
  },
  fail(e){if(e.staleSession)return;this.error=e.message||'暂时读取不到，请重试';if(ACCESS.test(this.error))this.$emit('access-change')},
  // 正在读取时不打开：等最新的设置读回来再改。打开时把当时的设置整份复制一份跟着这次编辑走。
  open(editor){if(!this.canEdit||!this.loaded||this.loading||this.busy||!this.base)return;this.editor={...editor,base:JSON.parse(JSON.stringify(this.base))};this.formError='';this.uncertain=false;this.stale=false;this.notice='';uni.pageScrollTo({scrollTop:0,duration:0})},
  openWithdrawal(){if(!this.base)return;this.open({kind:'withdrawal',title:'修改提现规则',form:withdrawalForm(this.base.withdrawal?.values||{})})},
  openService(){if(!this.base)return;this.open({kind:'service',title:'修改分销商平台服务费',percent:rateToPercentInput(this.base.serviceFee?.distributorServiceRate)})},
  openDelivery(){if(!this.base)return;this.open({kind:'delivery',title:'修改配送与自提',form:deliveryForm(this.base.delivery||{})})},
  warehouseIndex(p){const i=this.warehouses.findIndex(w=>Number(w.id)===Number(p.warehouseId));return i<0?0:i},
  warehouseName(p){return p.warehouseId===null||p.warehouseId===undefined?'':(this.warehouses.find(w=>Number(w.id)===Number(p.warehouseId))||{}).name||''},
  pickWarehouse(p,e){const w=this.warehouses[Number(e.detail.value)];if(w)p.warehouseId=w.id},
  addPoint(){if(this.locked||this.editor?.kind!=='delivery')return;this.editor.form.points.push({key:newPointKey(),id:'',name:'',address:'',hours:'',warehouseId:null,pendingPickups:0})},
  async removePoint(i){if(this.locked||this.editor?.kind!=='delivery')return;const form=this.editor.form,p=form.points[i];if(p&&await ask('删除门店',removePointConfirmText(p),'确认删除')){const at=form.points.indexOf(p);if(at>=0)form.points.splice(at,1)}},
  read(){const e=this.editor,b=e.base;return e.kind==='withdrawal'?readWithdrawalForm(e.form,b.withdrawal.values):e.kind==='service'?readServiceRate(e.percent,b.serviceFee):readDeliveryForm(e.form,b.delivery,b.delivery.warehouses)},
  payload(kind,values,b){return kind==='withdrawal'?{base:b.withdrawal.values,values}:kind==='service'?{base:{distributorServiceRate:b.serviceFee.distributorServiceRate},values}:{base:b.delivery.base,...values}},
  // Sends the values seen when the editor opened (editor.base) with the whole new section; the server refuses if someone else changed it since.
  async submit(){
   if(this.busy||!this.editor||this.uncertain)return
   const r=this.read();if(r.error){this.formError=r.error;return}
   const kind=this.editor.kind,b=this.editor.base
   const title={withdrawal:'保存提现规则',service:'保存服务费',delivery:'保存配送设置'}[kind]
   const text=kind==='withdrawal'?withdrawalConfirmText(b.withdrawal.values,r.values):kind==='service'?serviceConfirmText(b.serviceFee,r.values):deliveryConfirmText(b.delivery,r.values,b.delivery.warehouses)
   const token=getToken();this.busy=true;this.$emit('busy',true);this.formError='';this.stale=false
   try{
    if(!await ask(title,text,'确认保存'))return
    if(token!==getToken())return
    await request('/staff/manage/settings/'+{withdrawal:'withdrawal',service:'service-fee',delivery:'delivery'}[kind],'POST',this.payload(kind,r.values,b))
    if(token!==getToken())return
    this.editor=null;uni.showToast({title:'已保存',icon:'none'})
    this.busy=false;this.$emit('busy',false)
    if(await this.load())this.notice=afterSaveMismatch(kind,r.values,this.data)
   }catch(e){
    if(e.staleSession)return
    this.formError=e.message||'保存没有成功，请重试';this.uncertain=!!e.uncertain;this.stale=STALE_SETTINGS.test(this.formError)
    if(ACCESS.test(this.formError))this.$emit('access-change')
   }finally{if(this.busy){this.busy=false;this.$emit('busy',false)}}
  },
  closeEditor(){if(this.busy)return;const check=this.uncertain||this.stale;this.editor=null;this.formError='';this.uncertain=false;this.stale=false;if(check)this.load()},
  reloadLatest(){if(this.busy)return;this.editor=null;this.formError='';this.uncertain=false;this.stale=false;this.load()}
 }
}
</script>
<style scoped>
@import '../../../styles/component-base.css';@import '../styles/staff-module.css';
.settings .line>text:last-child{text-align:right}
.action{margin-top:12px}
.point{padding:8px 0;border-bottom:1px solid var(--shop-border,#d5e6ee)}
.point:last-of-type{border-bottom:0}
.notice-line{margin-top:12px}
.store-editor .label:first-child{margin-top:0}
</style>
