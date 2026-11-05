<template>
 <view class="invoices">
  <view v-if="targetOrderId" class="card order-context"><text class="heading">本订单发票</text><text class="hint">{{targetOrder?.order_no||'正在核对订单…'}}</text></view>
  <view v-if="error" class="card"><text>{{error}}</text><button class="ui-button" @click="load">重试</button></view>
  <view v-if="orderOptions.length" class="card invoice-form">
   <text class="heading">{{selectedInvoice?'修改开票资料':'申请发票'}}</text><text class="hint">按订单申请，已退款金额会扣除。通常3个工作日处理；票据由财务开具并上传。</text>
   <view v-if="targetOrderId" class="input selected-order">{{orderOptions.find(o=>o.id===orderId)?.label}}</view>
   <picker v-else :disabled="loading" :range="orderOptions" range-key="label" @change="selectOrder(orderOptions[Number($event.detail.value)]?.id||0)"><view class="input">{{orderOptions.find(o=>o.id===orderId)?.label||'选择需要开票的订单'}} ›</view></picker>
   <picker :range="['个人抬头','企业抬头']" @change="form.titleKind=Number($event.detail.value)===1?'company':'personal'"><view class="input">{{form.titleKind==='company'?'企业抬头':'个人抬头'}} ›</view></picker>
   <input v-model="form.title" maxlength="150" placeholder="填写发票抬头"/><input v-if="form.titleKind==='company'" v-model="form.taxNumber" maxlength="20" placeholder="企业税号"/><input v-model="form.email" maxlength="150" placeholder="接收邮箱"/>
   <text v-if="!orderId" class="hint">请先选择上方需要开票的订单。</text><button class="ui-button" :disabled="busy||loading||!orderId" @click="apply">{{busy?'正在提交…':selectedInvoice?'保存并提交':'提交申请'}}</button>
  </view>
  <view v-else-if="!loading&&!error&&!visibleInvoices.length" class="card"><text class="hint">{{targetOrderId?(targetOrder?invoiceHint(targetOrder,canCompany):'订单不存在或暂无查看权限'):'暂无可申请订单：仅已付款、未全额退款且尚可开票的订单可申请。'}}</text></view>
  <view v-for="i in visibleInvoices" :key="i.id" class="card invoice-record">
   <text class="heading">{{invoiceStatus(i)}}</text><view>订单 {{i.order_no}}</view><view>抬头 {{i.title}}</view><view>当前可开金额 ¥{{money(i.available_amount)}}</view><view v-if="i.status==='requested'">预计处理日期：{{i.due_date}}</view><view v-if="i.note">{{i.note}}</view>
   <button class="ui-button" v-if="['requested','rejected'].includes(i.status)&&orderOptions.some(o=>Number(o.id)===Number(i.order_id))" @click="edit(i)">修改抬头资料</button>
   <view v-for="f in i.files" :key="f.id" class="file"><view>{{f.file_kind==='adjustment'?'后续处理文件':'原票据文件'}} · {{f.invoice_number}}</view><text class="hint">{{f.note}}</text><button class="ui-button" :disabled="busy" @click="download(f)">下载查看文件</button></view>
  </view>
  <text v-if="!loading&&!error&&!visibleInvoices.length&&orderOptions.length" class="hint">{{targetOrderId?'本订单尚未申请发票。':'暂无发票申请。'}}</text>
 </view>
</template>
<script>
import {refreshOnTick} from '../services/panel-refresh'
import {request,money,notify,API_BASE,getToken} from '../services/shop.js'
import {canApplyInvoice,invoiceAmount,invoiceStatus,invoiceHint} from '../services/invoice-display'
const blankForm=()=>({titleKind:'personal',title:'',taxNumber:'',email:''})
export default {
 mixins:[refreshOnTick()],props:{canCompany:Boolean,initialOrderId:{type:[Number,String],default:0}},
 data(){return{invoices:[],orders:[],orderId:0,form:blankForm(),busy:false,loading:false,error:'',sequence:0,focusedOrderId:0}},
 computed:{
  targetOrderId(){const id=Number(this.initialOrderId);return Number.isSafeInteger(id)&&id>0?id:0},
  targetOrder(){return this.orders.find(o=>Number(o.id)===this.targetOrderId)},
  visibleInvoices(){return this.targetOrderId?this.invoices.filter(i=>Number(i.order_id)===this.targetOrderId):this.invoices},
  selectedInvoice(){return this.invoices.find(i=>Number(i.order_id)===Number(this.orderId))},
  orderOptions(){return this.orders.filter(o=>(!this.targetOrderId||Number(o.id)===this.targetOrderId)&&canApplyInvoice(o,this.canCompany)&&!this.invoices.some(i=>Number(i.order_id)===Number(o.id)&&['issued','adjustment_required','cancelled'].includes(i.status))).map(o=>({id:o.id,label:o.order_no+' · ¥'+money(invoiceAmount(o))}))}
 },
 watch:{initialOrderId(){this.focusedOrderId=0;this.orderId=0;this.form=blankForm();this.load()}},mounted(){this.load()},
 methods:{money,invoiceStatus,invoiceHint,
  async load(){const sequence=++this.sequence,token=getToken();this.loading=true;try{const[invoices,orders]=await Promise.all([request('/invoices'),request('/orders')]);if(this._panelRefreshDisposed||sequence!==this.sequence||token!==getToken())return;this.invoices=invoices;this.orders=orders;this.error='';if(this.targetOrderId&&this.focusedOrderId!==this.targetOrderId){this.selectOrder(this.targetOrderId);this.focusedOrderId=this.targetOrderId}if(this.orderId&&!this.orderOptions.some(o=>Number(o.id)===Number(this.orderId)))this.orderId=0}catch(e){if(!this._panelRefreshDisposed&&sequence===this.sequence&&token===getToken())this.error=e.message}finally{if(sequence===this.sequence)this.loading=false}},
  selectOrder(id){this.orderId=id;const i=this.invoices.find(i=>Number(i.order_id)===Number(id));this.form=i?{titleKind:i.title_kind,title:i.title,taxNumber:i.tax_number||'',email:i.email}:blankForm()},
  async act(fn){if(this.busy)return;this.busy=true;try{await fn()}catch(e){notify(e)}finally{this.busy=false}},
  apply(){this.act(async()=>{if(!this.orderOptions.some(o=>Number(o.id)===Number(this.orderId)))throw Error('请先选择可申请的订单');if(this.form.title.trim().length<2)throw Error('请填写发票抬头');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim()))throw Error('请填写正确邮箱');await request('/invoices','POST',{orderId:this.orderId,...this.form});await this.load();uni.showToast({title:'已提交发票申请',icon:'none'})})},
  edit(i){this.selectOrder(i.order_id);uni.pageScrollTo({scrollTop:0,duration:200})},
  download(f){this.act(async()=>{const url=API_BASE+'/shop/app/invoices/files/'+f.id,header={'X-Shop-Token':'Bearer '+getToken()};
// #ifdef H5
const res=await fetch(url,{headers:header});if(!res.ok||res.headers.get('content-type')?.includes('json'))throw Error('票据下载失败，请重新登录后重试');const href=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=href;a.download=f.original_name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
// #endif
// #ifndef H5
await new Promise((resolve,reject)=>uni.downloadFile({url,header,success:r=>{if(r.statusCode!==200)return reject(Error('下载失败'));if(/\.pdf$/i.test(f.original_name))uni.openDocument({filePath:r.tempFilePath,fileType:'pdf',showMenu:true,success:resolve,fail:()=>reject(Error('文件无法打开'))});else uni.previewImage({urls:[r.tempFilePath],success:resolve,fail:()=>reject(Error('图片无法打开'))})},fail:()=>reject(Error('下载失败，请检查网络'))}));
// #endif
  })}
 }
}
</script>
<style scoped>
@import '../styles/component-base.css';
.invoices{padding:12px;font-size:14px;color:var(--shop-text, #2b424f)}.card{padding:18px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:14px;margin-bottom:14px;line-height:1.8;overflow-wrap:anywhere}.heading{display:block;font-size:17px;font-weight:600}.hint{display:block;color:var(--shop-muted, #59727f);font-size:13px;line-height:1.7;margin-top:6px}input,.input{background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:8px;padding:12px;margin:12px 0;overflow-wrap:anywhere}.selected-order{font-size:13px}button{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);font-size:14px;margin-top:14px;min-height:44px;line-height:1.5;padding:10px 12px}.file{border-top:1px solid var(--shop-border, #d5e6ee);margin-top:14px;padding-top:12px}input{height:46px;min-height:46px;line-height:46px;padding:0 12px;width:100%;font-size:14px}.invoice-record view{margin-top:5px}
</style>
