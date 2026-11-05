<template>
 <view class="sales-orders">
  <view class="sales-intro"><text class="title">我卖出的订单</text><text class="hint">客户打开你的分享链接并登录，首次绑定成功后，买的商品和订单佣金会记在你名下。零售客户不需要申请成为分销商。</text><text class="hint">已绑定其他分销员的客户，订单仍按原归属记录。</text></view>
  <view class="sales-tabs"><button v-for="tab in tabs" :key="tab.value" class="ui-button sales-tab" :class="{active:kind===tab.value}" :aria-pressed="kind===tab.value" @click="selectKind(tab.value)">{{tab.label}}</button></view>
  <view v-if="error" class="error" role="alert"><text>{{error}}</text><button class="ui-button" :disabled="loading" @click="load(false)">重新加载</button></view>
  <view v-if="!rows.length&&loading" class="loading">正在加载成交订单…</view>
  <template v-if="loaded">
   <view class="sales-count"><text>共 {{total}} 笔成交订单</text><button class="ui-button refresh" :loading="loading" :disabled="loading" @click="load(false)">刷新</button></view>
   <view v-if="!rows.length&&!error" class="empty"><text class="empty-title">{{kind==='partner'?'还没有加盟拿货订单':kind==='retail'?'还没有零售客户成交':'还没有成交订单'}}</text><text class="hint">{{kind==='partner'?'下级加盟商付款拿货后，可查看符合利差规则的订单。':'分享商品给客户，客户绑定你并付款后即可在这里查看。'}}</text><button class="ui-button primary" @click="go('promote')">去分享商品</button></view>
   <view v-for="order in rows" :key="order.id" class="sale-record">
    <view class="sale-header"><text class="customer">{{order.buyer_nickname||'商城客户'}}</text><text class="status">{{statusLabel(order.status)}}</text></view>
    <view class="metadata"><text>{{order.business_type==='partner'?'加盟拿货差价 · 直属下级拿货':'零售客户订单'}}</text><text selectable>订单 {{order.order_no}}</text><text>{{formatDate(order.paid_at||order.created_at)}}</text></view>
    <view v-for="item in order.items||[]" :key="item.id" class="sale-item">
     <image v-if="item.image" :src="asset(item.image,160)" mode="aspectFit"/>
     <view class="item-info"><text class="item-name">{{item.name}}</text><text class="hint">{{item.spec||'默认规格'}} · {{item.quantity}} 件</text></view>
     <text class="item-price">¥{{money(item.price)}}</text>
    </view>
    <view class="sale-totals"><view><text class="hint">订单实付款</text><text>¥{{money(order.amount)}}</text></view><view class="commission"><text class="hint">{{order.business_type==='partner'?'拿货差价佣金':'我的佣金'}}</text><text>¥{{money(order.commission_amount)}}</text></view></view>
    <text v-if="Number(order.refunded_amount)>0" class="refund">已退款 ¥{{money(order.refunded_amount)}}，佣金按退款结果调整。</text>
    <text class="commission-note">{{order.commission_reason||commissionHint(order)}}</text>
   </view>
   <button v-if="rows.length<total" class="ui-button load-more" :loading="loading" :disabled="loading" @click="load(true)">加载更多订单</button>
   <text v-else-if="rows.length" class="end">已显示全部订单</text>
  </template>
 </view>
</template>
<script>
import {request,asset,money,go,getToken} from '../services/shop'
import {formatDate} from '../services/display'
export default {
 props:{refreshTick:{default:0}},
 data(){return{rows:[],total:0,page:0,loading:false,loaded:false,error:'',reloadQueued:false,kind:'all',selectionVersion:0,tabs:[{value:'all',label:'全部订单'},{value:'retail',label:'零售客户订单'},{value:'partner',label:'加盟拿货订单'}]}},
 watch:{refreshTick(){this.load(false)}},mounted(){this.load(false)},
 methods:{asset,money,go,formatDate,
  selectKind(kind){if(kind===this.kind)return;this.kind=kind;this.selectionVersion++;this.rows=[];this.total=0;this.page=0;this.loaded=false;this.error='';this.load(false)},
  statusLabel(status){return ({paid:'待发货',shipping:'部分发货',shipped:'待收货',completed:'已完成',refunded:'已退款',cancelled:'已关闭'})[status]||'订单处理中'},
  commissionHint(order){if(Number(order.commission_amount)<=0)return Number(order.refunded_amount)>0?'退款后无有效佣金':'已记录成交归属，本单佣金为 0 元';return '可提现 ¥'+money(order.available_commission)+' · 待结算 ¥'+money(order.pending_commission)},
  async load(more=false){
   if(this.loading){if(!more)this.reloadQueued=true;return}
   const token=getToken(),version=this.selectionVersion,next=more?this.page+1:1
   this.loading=true;this.error=''
   try{
    const data=await request('/sales-orders?page='+next+'&pageSize=20&kind='+this.kind)
    if(token!==getToken()||version!==this.selectionVersion)return
    const rows=Array.isArray(data?.rows)?data.rows:[]
    this.rows=more?[...this.rows,...rows.filter(row=>!this.rows.some(old=>old.id===row.id))]:rows
    this.total=Number(data.total)||0;this.page=Number(data.page)||next;this.loaded=true
   }catch(e){if(!e.staleSession&&token===getToken()&&version===this.selectionVersion)this.error=e.message||'订单暂时无法加载，请重试'}
   finally{this.loading=false;if(this.reloadQueued){this.reloadQueued=false;this.load(false)}}
  }
 }
}
</script>
<style scoped>
@import '../styles/component-base.css';
.sales-tabs{display:flex;gap:4px;border-bottom:1px solid var(--shop-border, #d5e6ee);margin-bottom:14px}.sales-tab{flex:1;min-width:0;margin:0;padding:12px 2px;min-height:44px;font-size:13px;line-height:1.5;border-radius:0;background:transparent;color:var(--shop-ink, #28546c)}.sales-tab.active{color:var(--shop-text, #2b424f);font-weight:600;border-bottom:2px solid var(--shop-control, #417c9a)}
.sales-orders{padding:16px 14px 28px;color:var(--shop-text, #2b424f)}.sales-intro{padding:8px 2px 16px}.title{display:block;font-size:22px;font-weight:600;line-height:1.5}.hint{display:block;font-size:12px;line-height:1.8;color:var(--shop-muted, #59727f)}.sales-intro>.hint{margin-top:8px}.sales-count,.sale-header,.sale-totals{display:flex;justify-content:space-between;align-items:center;gap:12px}.sales-count{font-size:13px;padding:0 2px 10px;color:var(--shop-muted, #59727f)}.refresh{font-size:13px;min-height:40px;padding:8px 12px;color:var(--shop-ink, #28546c);background:transparent;margin:0}.sale-record{border:1px solid var(--shop-border, #d5e6ee);border-radius:10px;background:var(--shop-background, #f3f8fb);margin-bottom:14px;padding:16px}.customer{font-size:15px;font-weight:600;overflow-wrap:anywhere;min-width:0}.status{font-size:12px;white-space:nowrap;color:var(--shop-ink, #28546c)}.metadata{margin-top:8px;display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--shop-muted, #59727f);line-height:1.7;overflow-wrap:anywhere}.sale-item{display:flex;align-items:center;gap:10px;padding:16px 0;border-bottom:1px solid var(--shop-border, #d5e6ee)}.sale-item>image{width:56px;height:68px;border-radius:5px;background:var(--shop-background, #f3f8fb)}.item-info{flex:1;min-width:0}.item-name{display:block;font-size:14px;line-height:1.6;overflow-wrap:anywhere}.item-price{font-size:13px;white-space:nowrap;color:var(--shop-ink, #28546c)}.sale-totals{padding-top:14px;align-items:flex-start;font-size:16px}.sale-totals>view{display:flex;flex-direction:column;gap:3px}.commission{text-align:right;color:var(--shop-ink, #28546c);font-weight:600}.commission>.hint{font-weight:400}.refund,.commission-note{display:block;font-size:12px;line-height:1.8;margin-top:10px;overflow-wrap:anywhere}.refund{color:#985e37}.commission-note{color:var(--shop-muted, #59727f)}.empty{text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;padding:45px 16px}.empty-title{font-size:18px}.primary{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);margin-top:8px;padding:10px 22px}.load-more{width:100%;background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}.end,.loading{display:block;color:var(--shop-muted, #59727f);text-align:center;font-size:13px;padding:22px 8px}.error{padding:14px;background:#faf0e7;color:#875f3d;font-size:14px;line-height:1.8}.error>button{background:#fdf9f4;color:#875f3d;margin-top:10px}
</style>
