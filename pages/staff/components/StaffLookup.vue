<template>
 <view class="module-panel lookup">
  <template v-if="!top">
   <view class="panel-heading"><view><text class="panel-title">{{info.title}}</text><text class="hint">{{info.hint}}</text></view><button class="small-button" :disabled="loading||busy" @click="refresh">刷新</button></view>
   <view class="search-row"><input v-model="q" confirm-type="search" maxlength="40" placeholder="手机号、尾号、昵称、订单号或 #会员编号" aria-label="查找客户或订单" @confirm="search"/><button class="small-button" :disabled="loading" @click="search">查询</button></view>
   <text class="hint">{{help}}</text>
   <text v-if="searchError" class="error" role="alert">{{searchError}}</text>
   <text v-if="error" class="error" role="alert">{{error}}</text>
   <view v-if="loading&&!result" class="empty">正在查找…</view>
   <view v-else-if="!result&&!error" class="empty">输入手机号、昵称或订单号开始查找</view>
   <template v-if="result">
    <text class="hint searched">按{{kindLabel}}查找「{{searchedQ}}」{{loading?' · 正在更新…':''}}</text>
    <template v-if="!(result.rows&&result.rows.length)">
     <view class="empty">没有找到匹配的客户或订单</view>
     <text class="hint">可以换成完整手机号或完整订单号再查。</text>
    </template>
    <template v-if="members.length">
     <text class="section-label">客户（{{members.length}}）</text>
     <view v-for="m in members" :key="'m'+m.memberId" class="record lookup-member" role="button" @click="openMember(m.memberId)">
      <view class="line head"><text class="record-title">{{memberTitle(m)}}</text><view class="tags"><text v-if="m.isTest" class="tag">测试</text><text v-if="m.enabled===false" class="tag warn">账号已停用</text></view></view>
      <text class="hint">会员编号 {{m.memberId}} · {{m.phone||(['phone','phoneTail'].includes(searchedKind)?'账号未留手机号（收货或下单电话与查询一致）':'未留手机号')}}</text>
      <text class="hint">{{identityText(m.identities)}} · 注册 {{formatDate(m.createdAt)}}</text>
     </view>
    </template>
    <template v-if="orders.length">
     <text class="section-label">订单（{{orders.length}}）</text>
     <view v-for="o in orders" :key="'o'+o.orderId" class="record lookup-order" role="button" @click="openOrder(o.orderId)">
      <view class="line head"><text class="record-title">{{orderStatusText(o)}}</text><view class="tags"><text v-if="o.isTest" class="tag">测试</text></view></view>
      <text class="hint" selectable>订单号 {{o.orderNo}}</text>
      <text class="hint">{{yuan(o.amount)}} · {{formatDate(o.paidAt||o.createdAt)}} {{o.paidAt?'付款':'下单'}} · 买家 {{o.buyerNickname||'商城顾客'}}</text>
     </view>
    </template>
    <text v-if="result.more" class="hint">只显示前 20 条，请输入更完整的内容缩小范围。</text>
   </template>
  </template>

  <template v-else>
   <button class="text-button" :disabled="busy" @click="back">‹ 返回</button>
   <view v-if="top.loading&&!top.data" class="empty">正在读取…</view>
   <text v-if="top.error" class="error" role="alert">{{top.error}}</text>
   <button v-if="top.error" class="secondary" :disabled="top.loading" @click="loadEntry(top)">重新读取</button>

   <template v-if="top.kind==='member'&&top.data&&top.data.member">
    <view class="accent-block">
     <text class="record-title">{{memberTitle(top.data.member)}}</text>
     <text class="block-line">会员编号 {{top.data.member.memberId}}</text>
     <text v-if="!top.data.member.phone" class="block-line">未留手机号</text>
     <text v-else-if="callablePhone(top.data.member.phone)" class="block-line phone" @click="call(top.data.member.phone)">{{top.data.member.phone}} · 拨打</text>
     <text v-else class="block-line">{{top.data.member.phone}}</text>
     <text class="block-line">注册时间 {{formatDate(top.data.member.createdAt)}}</text>
     <view class="tags left"><text class="tag">{{identityText(top.data.member.identities)}}</text><text v-if="top.data.member.isTest" class="tag">测试</text><text v-if="top.data.member.enabled===false" class="tag warn">账号已停用</text></view>
     <text v-if="top.data.member.companyName" class="block-line">企业：{{top.data.member.companyName}}</text>
    </view>
    <view class="line link-line" :class="{link:!!top.data.referrer}" @click="openReferrer"><text>上级推广人</text><text class="strong">{{top.data.referrer?personLine(top.data.referrer)+' ›':'无'}}</text></view>
    <template v-if="showMoney">
     <view class="money-lines">
      <view v-for="line in walletRows" :key="line.label"><text>{{line.label}}</text><text>{{yuan(line.value)}}</text></view>
      <view><text>积分</text><text>{{pointsLine}}</text></view>
      <view><text>可提现佣金</text><text>{{yuan(commission.withdrawable)}}</text></view>
      <view><text>待结算佣金</text><text>{{yuan(commission.pending)}}</text></view>
      <view v-if="commission.withdrawing>0"><text>提现处理中</text><text>{{yuan(commission.withdrawing)}}</text></view>
      <view v-if="commission.withdrawalFrozen"><text>提现状态</text><text class="tag warn">提现已冻结</text></view>
     </view>
     <text class="hint">待结算佣金过了售后期才能提现。</text>
    </template>
    <text v-else class="hint money-hidden">余额、积分和佣金只有店长和财务能看到。</text>
    <text class="section-label">最近订单</text>
    <view v-for="o in memberOrders" :key="'mo'+o.orderId" class="record lookup-order" role="button" @click="openOrder(o.orderId)">
     <view class="line head"><text class="record-title">{{orderStatusText(o)}}</text><view class="tags"><text v-if="o.isTest" class="tag">测试</text></view></view>
     <text class="hint" selectable>订单号 {{o.orderNo}}</text>
     <text class="hint">{{yuan(o.amount)}} · {{formatDate(o.paidAt||o.createdAt)}} {{o.paidAt?'付款':'下单'}} · 买家 {{o.buyerNickname||'商城顾客'}}</text>
     <text v-if="o.itemsText" class="hint">{{o.itemsText}}</text>
    </view>
    <view v-if="!memberOrders.length" class="empty">还没有订单</view>
    <text v-if="memberOrderTotal>memberOrders.length" class="hint">只显示最近 20 笔，共 {{memberOrderTotal}} 笔；更早的订单请用订单号查找。</text>
   </template>

   <template v-if="top.kind==='order'&&top.data&&top.data.order">
    <view class="accent-block">
     <view class="line head"><text class="record-title">{{orderStatusText(top.data.order)}}</text><view class="tags"><text v-if="top.data.order.isTest" class="tag">测试</text></view></view>
     <text class="block-line" selectable>订单号 {{top.data.order.orderNo}}</text>
     <text class="block-line">下单 {{formatDate(top.data.order.createdAt)}}{{top.data.order.paidAt?' · 付款 '+formatDate(top.data.order.paidAt):''}}</text>
     <text class="block-line">{{top.data.order.businessLabel}}</text>
    </view>
    <view v-if="top.data.buyer" class="line link-line link" @click="openMember(top.data.buyer.memberId)"><text>买家</text><text class="strong">{{(top.data.buyer.nickname||'商城顾客')+'（会员编号 '+top.data.buyer.memberId+'） ›'}}</text></view>

    <text class="section-label">商品</text>
    <view v-for="(item,index) in top.data.items||[]" :key="index" class="record item">
     <image v-if="item.image" class="item-image" :src="asset(item.image,160)" mode="aspectFit"/>
     <view class="item-info">
      <text class="strong">{{item.name}}</text>
      <text class="hint">{{item.spec||'默认规格'}} × {{item.quantity}} · 单价 {{yuan(item.price)}}</text>
      <text v-if="item.refundedQuantity>0" class="hint warn-note">已退款 {{item.refundedQuantity}} 件</text>
      <text v-if="item.toShip>0&&['paid','shipping'].includes(top.data.order.status)&&delivery.method!=='pickup'" class="hint">还需发 {{item.toShip}} 件</text>
     </view>
    </view>

    <text class="section-label">金额</text>
    <view class="money-lines">
     <view v-for="line in amountRows" :key="line.label"><text>{{line.label}}</text><text>{{line.value<0?'-'+yuan(-line.value):yuan(line.value)}}</text></view>
     <view class="strong"><text>实付金额</text><text>{{yuan(amounts.amount)}}</text></view>
     <view v-if="amounts.refunded>0"><text>已退款</text><text>{{yuan(amounts.refunded)}}</text></view>
     <view><text>付款方式</text><text>{{paymentModeText(top.data.payment)}}</text></view>
    </view>
    <text v-if="paymentPartsText(top.data.payment)" class="hint">{{paymentPartsText(top.data.payment)}}</text>
    <text v-if="refundPartsText(top.data.payment)" class="hint">{{refundPartsText(top.data.payment)}}</text>

    <text class="section-label">配送</text>
    <view class="record">
     <text class="hint">{{delivery.methodLabel}}{{delivery.pickup&&delivery.pickup.store&&delivery.pickup.store.name?' · '+delivery.pickup.store.name:''}}</text>
     <text v-if="delivery.method==='pickup'&&delivery.pickup&&delivery.pickup.store&&delivery.pickup.store.address" class="hint">门店地址 {{delivery.pickup.store.address}}</text>
     <view v-if="hasRecipient" class="recipient-line"><text class="strong">{{(delivery.method==='pickup'?'取货人 ':'')+(delivery.recipient.name||'未填写姓名')}}</text><text v-if="callablePhone(delivery.recipient.phone)" class="phone" @click="call(delivery.recipient.phone)">{{delivery.recipient.phone}} · 拨打</text><text v-else-if="delivery.recipient.phone">{{delivery.recipient.phone}}</text></view>
     <text v-if="delivery.recipient&&delivery.recipient.address&&delivery.method!=='pickup'" class="hint" selectable>{{delivery.recipient.address}}</text>
     <text v-if="delivery.addressHidden&&delivery.method!=='pickup'" class="hint">收货地址只有能发货的同事能看到。</text>
     <text v-if="delivery.method==='pickup'" class="hint">{{pickupStatusText({deliveryMethod:'pickup',pickupStatus:delivery.pickup&&delivery.pickup.status})}}</text>
     <text v-for="(s,index) in top.data.shipments||[]" :key="'s'+index" class="hint" selectable>已寄出：{{s.carrier}} {{s.tracking}}{{s.fullyRefunded?' · 已全部退款':''}}</text>
    </view>

    <template v-if="afterSales.length">
     <text class="section-label">售后</text>
     <view class="record">
      <view v-for="c in afterSales" :key="'c'+c.id" class="case-line"><text class="block-line">{{c.typeLabel}} · {{c.statusLabel}} · {{yuan(c.amount)}}</text><text v-if="c.refundStateLabel" class="hint">{{c.refundStateLabel}}</text></view>
      <text v-if="top.data.legacyAfterSaleOpen" class="hint">还有一笔旧售后待处理。</text>
      <button v-if="me.canViewCases===true" class="small-button action" :disabled="busy" @click="openCases">去售后处理</button>
     </view>
    </template>
    <text v-else-if="top.data.legacyAfterSaleOpen" class="hint">还有一笔旧售后待处理。</text>

    <view class="line"><text>微信发货信息</text><text class="strong">{{(top.data.wechatShipping&&top.data.wechatShipping.label)||'—'}}</text></view>
    <text v-if="top.data.wechatShipping&&top.data.wechatShipping.hint" class="notice-block">{{top.data.wechatShipping.hint}}</text>
    <view class="line"><text>推广人</text><text class="strong">{{(top.data.salesperson&&top.data.salesperson.label)||'无'}}</text></view>

    <text class="section-label">订单进度</text>
    <text v-for="t in top.data.timeline||[]" :key="'t'+t.id+t.time" class="hint">{{formatDate(t.time)}} {{t.title}}{{t.detail?' · '+t.detail:''}}</text>
    <text v-if="!(top.data.timeline&&top.data.timeline.length)" class="hint">{{top.data.timelineNote||'暂无记录'}}</text>

    <button v-if="top.data.shippable===true&&me.canShip===true" class="primary" :disabled="busy" @click="openShip(top.data.order)">发货</button>
    <text v-if="delivery.method==='pickup'&&top.data.order.status==='paid'" class="hint">自提备货和核销请到「订单发货 → 待自提」里处理。</text>
   </template>
  </template>

  <view v-if="shipSheet" class="overlay" @click="closeShip">
   <view class="sheet" @click.stop>
    <text class="sheet-title">填写发货信息</text>
    <text class="sheet-hint">订单号 {{shipSheet.order.orderNo}}</text>
    <text v-if="hasRecipient" class="sheet-hint">寄给 {{delivery.recipient.name}} {{delivery.recipient.address||''}}</text>
    <text class="form-label">物流公司</text>
    <input class="field" :value="shipSheet.carrier" :disabled="!!shipSheet.uncertain" maxlength="80" placeholder="例如 顺丰速运" @input="shipSheet.carrier=$event.detail.value;shipSheet.error=''"/>
    <view class="chips"><text v-for="c in carriers" :key="c" class="chip" :class="{on:c===shipSheet.carrier}" @click="pickCarrier(c)">{{c}}</text></view>
    <text class="form-label">运单号</text>
    <view class="field-row"><input class="field" :value="shipSheet.tracking" :disabled="!!shipSheet.uncertain" maxlength="100" placeholder="填写快递单上的运单号" @input="shipSheet.tracking=$event.detail.value;shipSheet.error=''"/><button v-if="isWechat" class="scan" :disabled="!!shipSheet.uncertain" @click="scanTracking">扫一扫</button></view>
    <text class="sheet-note">这张订单还没寄出的商品会全部记为已发货，顾客可以在订单里看到物流。需要分几次寄出时，请在电脑后台操作。</text>
    <text v-if="shipSheet.error" class="sheet-error" role="alert">{{shipSheet.error}}</text>
    <view class="sheet-actions"><button class="plain" :disabled="busy" @click="closeShip">{{shipSheet.uncertain?'关闭':'取消'}}</button><button class="primary sheet-primary" :loading="busy" :disabled="busy||!!shipSheet.uncertain" @click="submitShip">{{shipSheet.uncertain?'请先核对订单状态':'确认发货'}}</button></view>
   </view>
  </view>
 </view>
</template>
<script>
import {request,getToken,asset} from '../../../services/shop'
import {formatDate} from '../../../services/display'
import {yuan,pickupStatusText,shipFormError,normalizeTracking} from '../../../services/staff-workbench'
import {paymentModeText,paymentPartsText,refundPartsText} from '../../../services/order-display'
import {MANAGEMENT_MODULES} from '../services/staff-management'
import {classifySearch,SEARCH_HELP,SEARCH_KIND_LABEL,identityText,orderStatusText,callablePhone,memberTitle,personLine,pushView,walletLines,orderAmountLines} from '../services/staff-lookup'
const LAST_CARRIER='shop-staff-carrier'
const ACCESS=/绑定|权限|无权|登录/
const ask=(title,content,confirmText)=>new Promise(resolve=>uni.showModal({title,content,confirmText,cancelText:'再看看',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))
export default {
 props:{module:{required:true},me:{required:true}},
 emits:['access-change','busy','open-module'],
 data(){return{q:'',searchError:'',result:null,searchedQ:'',searchedKind:'',loading:false,error:'',sequence:0,
  stack:[],detailSeq:0,busy:false,shipSheet:null,isWechat:false,
  carriers:['顺丰速运','中通快递','圆通速递','韵达快递','申通快递','极兔速递','京东快递','邮政EMS']}},
 computed:{
  info(){return MANAGEMENT_MODULES.find(m=>m.key===this.module)||{}},
  help(){return SEARCH_HELP},
  kindLabel(){return SEARCH_KIND_LABEL[this.searchedKind]||''},
  top(){return this.stack.length?this.stack[this.stack.length-1]:null},
  showMoney(){return this.me.canViewMoney===true&&!!this.top?.data?.money},
  members(){return this.result?.kind==='members'?this.result.rows||[]:[]},
  orders(){return this.result?.kind==='orders'?this.result.rows||[]:[]},
  walletRows(){return walletLines(this.top?.data?.money?.wallet)},
  commission(){return this.top?.data?.money?.commission||{}},
  pointsLine(){const p=this.top?.data?.money?.points||{};return String(Number(p.available)||0)+(Number(p.debt)>0?'（待扣回 '+p.debt+'）':'')},
  memberOrders(){return this.top?.data?.orders?.rows||[]},
  memberOrderTotal(){return Number(this.top?.data?.orders?.total)||0},
  amounts(){return this.top?.data?.amounts||{}},
  amountRows(){return orderAmountLines(this.amounts)},
  delivery(){return this.top?.data?.delivery||{}},
  afterSales(){return Array.isArray(this.top?.data?.afterSales)?this.top.data.afterSales:[]},
  hasRecipient(){const r=this.delivery.recipient;return !!(r&&(r.name||r.phone||r.address))}
 },
 mounted(){
  // #ifdef MP-WEIXIN
  this.isWechat=true
  // #endif
 },
 beforeUnmount(){this.sequence++;this.detailSeq++},
 methods:{
  formatDate,yuan,asset,pickupStatusText,paymentModeText,paymentPartsText,refundPartsText,identityText,orderStatusText,callablePhone,memberTitle,personLine,
  refresh(){if(this.busy)return;if(this.top)return this.loadEntry(this.top);if(this.searchedQ)return this.runSearch(this.searchedQ,this.searchedKind)},
  fail(e){if(e.staleSession)return;this.error=e.message||'暂时读取不到，请重试';if(ACCESS.test(this.error))this.$emit('access-change')},
  search(){
   const c=classifySearch(this.q)
   if(c.error){this.searchError=c.error;return}
   this.searchError='';this.stack=[];this.runSearch(c.value,c.kind)
  },
  // The newest search wins; a refusal (for example too many searches) keeps the previous results on screen.
  async runSearch(value,kind){
   const seq=++this.sequence;this.loading=true;this.error=''
   try{const r=await request('/staff/manage/lookup?q='+encodeURIComponent(value));if(seq!==this.sequence)return;this.result=r||{kind:'members',rows:[],more:false};this.searchedQ=value;this.searchedKind=kind}
   catch(e){if(seq===this.sequence)this.fail(e)}
   finally{if(seq===this.sequence)this.loading=false}
  },
  // The entry is read back through this.top so later changes go through the screen's own (watched) copy.
  openMember(id){if(this.busy||!id)return;this.stack=pushView(this.stack,{kind:'member',id,data:null,loading:false,error:''});this.loadEntry(this.top);uni.pageScrollTo({scrollTop:0,duration:0})},
  openOrder(id){if(this.busy||!id)return;this.stack=pushView(this.stack,{kind:'order',id,data:null,loading:false,error:''});this.loadEntry(this.top);uni.pageScrollTo({scrollTop:0,duration:0})},
  async loadEntry(e){
   const seq=++this.detailSeq;e.loading=true;e.error=''
   try{const r=await request('/staff/manage/lookup/'+(e.kind==='member'?'members/':'orders/')+e.id);if(seq!==this.detailSeq||this.top!==e)return;e.data=r}
   catch(x){if(seq!==this.detailSeq||this.top!==e||x.staleSession)return;e.error=x.message||'暂时读取不到，请重试';if(ACCESS.test(e.error))this.$emit('access-change')}
   finally{if(seq===this.detailSeq)e.loading=false}
  },
  back(){if(this.busy)return;this.detailSeq++;if(this.top)this.top.loading=false;this.stack=this.stack.slice(0,-1);const t=this.top;if(t&&!t.data&&!t.loading)this.loadEntry(t);uni.pageScrollTo({scrollTop:0,duration:0})},
  call(phone){uni.makePhoneCall({phoneNumber:String(phone),fail:e=>{if(!/cancel/i.test(e?.errMsg||''))uni.showToast({title:'请用手机拨打 '+phone,icon:'none',duration:3000})}})},
  openReferrer(){const r=this.top?.data?.referrer;if(r&&r.memberId)this.openMember(r.memberId)},
  openCases(){this.$emit('open-module',{module:'cases'})},
  openShip(o){
   if(this.busy||!o)return
   let carrier=''
   try{carrier=uni.getStorageSync(LAST_CARRIER)||''}catch{}
   this.shipSheet={order:o,carrier,tracking:'',error:'',uncertain:false}
  },
  closeShip(){if(this.busy)return;this.shipSheet=null},
  pickCarrier(c){if(!this.shipSheet||this.shipSheet.uncertain)return;this.shipSheet.carrier=c;this.shipSheet.error=''},
  scanTracking(){
   uni.scanCode({scanType:['barCode','qrCode'],success:r=>{if(this.shipSheet&&!this.shipSheet.uncertain){this.shipSheet.tracking=normalizeTracking(r.result);this.shipSheet.error=''}},fail:e=>{if(!/cancel/i.test(e?.errMsg||''))uni.showToast({title:'没有识别到运单号，请手动填写',icon:'none'})}})
  },
  async submitShip(){
   const sheet=this.shipSheet;if(!sheet||this.busy||sheet.uncertain)return
   const problem=shipFormError(sheet);if(problem){sheet.error=problem;return}
   const carrier=String(sheet.carrier).trim(),tracking=normalizeTracking(sheet.tracking),token=getToken(),entry=this.top
   this.busy=true;this.$emit('busy',true);sheet.error=''
   try{
    if(!await ask('确认发货','物流公司：'+carrier+'\n运单号：'+tracking+'\n确认后顾客会在订单里看到物流信息。','确认发货'))return
    if(token!==getToken())return
    await request('/staff/orders/'+sheet.order.orderId+'/ship','POST',{carrier,tracking})
    try{uni.setStorageSync(LAST_CARRIER,carrier)}catch{}
    if(this.shipSheet===sheet)this.shipSheet=null
    uni.showToast({title:'已发货',icon:'success'})
   }catch(e){
    if(e.staleSession)return
    // 结果没收到：锁住这张表单，不让在同一张表单上再点一次；订单详情会自动重新读取
    sheet.uncertain=!!e.uncertain;sheet.error=e.uncertain?'网络不稳定，暂时不能确认是否已发货。订单已重新读取：请关闭这里，看订单是否已经发货，没发的话再重新发货。':(e.message||'发货没有成功，请重试')
    if(ACCESS.test(e.message||''))this.$emit('access-change')
   }finally{this.busy=false;this.$emit('busy',false);if(entry&&entry===this.top&&token===getToken())this.loadEntry(entry)}
  }
 }
}
</script>
<style scoped>
@import '../../../styles/component-base.css';@import '../styles/staff-module.css';
.head{margin-top:0;align-items:flex-start}
.tags.left{justify-content:flex-start;max-width:none;margin-top:6px}
.searched{margin-top:10px}
.link-line{margin:12px 2px}.link-line>text:last-child{text-align:right}
.link .strong{text-decoration:underline}
.phone{text-decoration:underline}
.money-hidden{margin-top:10px}
.item{display:flex;gap:10px;align-items:center;padding:12px}
.item-image{width:44px;height:52px;border-radius:5px;background:var(--shop-background,#f3f8fb);flex-shrink:0}
.item-info{flex:1;min-width:0}
.item-info .strong{display:block;overflow-wrap:anywhere}
.recipient-line{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:14px;margin-top:6px}
.case-line{padding:4px 0}
.action{margin-top:10px}
.sheet-hint{display:block;font-size:13px;color:var(--shop-muted,#59727f);line-height:1.7;overflow-wrap:anywhere}
.form-label{display:block;margin:16px 0 8px;font-size:13px;font-weight:600}
.field{width:100%;height:46px;padding:0 12px;background:var(--shop-background,#f3f8fb);border:1px solid var(--shop-border,#d5e6ee);border-radius:6px}
.field-row{display:flex;gap:8px;align-items:center}.field-row>.field{flex:1}
.scan{flex-shrink:0;min-height:46px}
.sheet-note{display:block;margin-top:12px;font-size:12px;color:var(--shop-muted,#59727f);line-height:1.8}
.sheet-error{display:block;margin-top:10px;padding:10px 12px;background:#faf0e7;color:#875f3d;font-size:13px;line-height:1.7;border-radius:6px}
.plain{background:var(--shop-soft,#eaf5fb);min-height:44px}
.sheet-primary{margin-top:0;min-height:44px}
</style>
