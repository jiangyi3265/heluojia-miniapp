<template>
 <view class="invoice-entry">
  <view class="invoice-heading"><text>发票</text><text class="invoice-state">{{loading?'正在读取…':error?'暂未读取':invoiceStatus(invoice)}}</text></view>
  <text class="invoice-hint">{{error||invoice?.note||invoiceHint(order,canCompany)}}</text>
  <view v-if="invoice" class="invoice-meta"><text>{{invoice.title}}</text><text v-if="invoice.status==='requested'&&invoice.due_date">预计处理日期：{{invoice.due_date}}</text></view>
  <view class="invoice-action"><text>可开票金额 ¥{{money(invoiceAmount(order))}}</text><button v-if="error" class="ui-button" @click="load">重新读取</button><button v-else-if="!loading&&(invoice||canApplyInvoice(order,canCompany))" class="ui-button" @click="$emit('open')">{{invoice?(['issued','adjustment_required'].includes(invoice.status)?'查看发票':invoice.status==='rejected'?'修改资料':'查看进度'):'申请开票'}}</button></view>
 </view>
</template>
<script>
import {refreshOnTick} from '../services/panel-refresh'
import {request,getToken,money} from '../services/shop'
import {invoiceAmount,canApplyInvoice,invoiceStatus,invoiceHint} from '../services/invoice-display'
export default {
 emits:['open'],mixins:[refreshOnTick()],props:{order:{type:Object,required:true},canCompany:Boolean},
 data(){return {invoice:null,loading:false,error:'',sequence:0}},
 watch:{'order.id'(){this.invoice=null;this.load()}},mounted(){this.load()},
 methods:{money,invoiceAmount,canApplyInvoice,invoiceStatus,invoiceHint,async load(){
  const id=this.order.id,token=getToken(),sequence=++this.sequence;this.loading=true;this.error='';
  try{const rows=await request('/invoices');if(this._panelRefreshDisposed||sequence!==this.sequence||token!==getToken()||id!==this.order.id)return;this.invoice=rows.find(i=>Number(i.order_id)===Number(id))||null}
  catch(e){if(!this._panelRefreshDisposed&&sequence===this.sequence&&token===getToken()){this.invoice=null;this.error=e.message||'发票状态读取失败'}}
  finally{if(sequence===this.sequence)this.loading=false}
 }}
}
</script>
<style scoped>
@import '../styles/component-base.css';
.invoice-entry{margin:12px;padding:18px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:14px;color:var(--shop-text, #2b424f)}.invoice-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:17px;font-weight:600}.invoice-state{font-size:13px;color:var(--shop-ink, #28546c);font-weight:400}.invoice-hint{display:block;margin-top:10px;font-size:13px;line-height:1.7;color:var(--shop-muted, #59727f);overflow-wrap:anywhere}.invoice-meta{display:flex;flex-direction:column;gap:4px;margin-top:10px;font-size:13px;line-height:1.7;overflow-wrap:anywhere}.invoice-action{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;font-size:13px}.invoice-action text{flex:1;min-width:0;overflow-wrap:anywhere}.invoice-action button{flex-shrink:0;margin:0;min-height:40px;padding:8px 16px;border:1px solid var(--shop-control, #417c9a);background:var(--shop-surface, #fdfeff);color:var(--shop-ink, #28546c);font-size:14px;line-height:1.5;white-space:nowrap}
</style>
