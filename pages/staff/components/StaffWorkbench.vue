<template>
 <view class="bench">
  <view class="bench-nav" :style="{paddingTop:statusBar+'px',paddingRight:capsule+'px'}">
   <view class="bench-nav-row"><view v-if="canGoBack" class="nav-back" aria-label="返回" @click="goBack"><UiIcon name="back"/></view><text class="nav-title">商家工作台</text></view>
  </view>

  <view v-if="state==='loading'" class="state-card"><text class="state-title">正在打开商家工作台…</text></view>

  <view v-else-if="state==='login'" class="state-card">
   <text class="state-title">请先登录</text>
   <text class="state-hint">商家工作台需要用已绑定的微信登录后才能使用。</text>
   <button class="ui-button primary" @click="goLogin">去登录</button>
   <button class="ui-button plain" @click="toShop">返回商城</button>
  </view>

  <view v-else-if="state==='unbound'" class="state-card">
   <text class="state-title">{{me&&me.disabled?'你的员工身份已被停用':'这个微信还没有绑定商家账号'}}</text>
   <text class="state-hint">{{me&&me.disabled?'你的员工账号已停用（或已没有商城权限），暂时不能使用手机管理。如需恢复，请联系店长在管理后台「员工与权限」处理后重新绑定。':'首次使用请在管理后台「员工与权限」获取绑定码，手机浏览器也可打开后台。绑定一次后，直接用微信进入手机管理。'}}</text>
   <button class="ui-button primary" @click="goBind">去输入绑定码</button>
   <button class="ui-button plain" @click="toShop">返回商城</button>
  </view>

  <view v-else-if="state==='error'" class="state-card" role="alert">
   <text class="state-title">工作台暂时打不开</text>
   <text class="state-hint">{{loadError}}</text>
   <button class="ui-button primary" @click="refresh">重新加载</button>
   <button class="ui-button plain" @click="toShop">返回商城</button>
  </view>

  <template v-else>
   <StaffModeSwitch current="manage" :staff="me" :locked="!!busy||moduleBusy"/>
   <view v-if="menuOpen" class="who">
    <view class="who-main"><text class="who-name">{{me.name||'店铺员工'}}</text><text class="who-role">{{me.roleLabel||'店铺员工'}}</text></view>
    <text v-if="abilities" class="who-abilities">{{abilities}}</text>

   </view>

   <view v-if="menuOpen" class="management-menu" :class="{dense}"><button v-for="m in modules" :key="m.key" role="button" :aria-label="m.title" :aria-pressed="activeModule===m.key" :class="{selected:activeModule===m.key}" :disabled="!!busy||moduleBusy" @click="chooseModule(m.key)"><UiIcon :name="m.icon" :active="activeModule===m.key" :size="dense?20:22"/><text>{{m.title}}</text></button></view>
   <view id="staff-module-content" class="module-content">
   <button v-if="!menuOpen" class="module-back" :disabled="!!busy||moduleBusy" @click="showModuleMenu">‹ 返回功能菜单</button>
   <StaffDashboard v-if="activeModule==='dashboard'" key="dashboard" ref="management" module="dashboard" :me="me" @access-change="refresh" @busy="moduleBusy=$event" @open-module="openModule"/>
   <StaffDistributors v-else-if="activeModule==='distributors'" key="distributors" ref="management" module="distributors" :me="me" @access-change="refresh" @busy="moduleBusy=$event"/>
   <StaffSettings v-else-if="activeModule==='settings'" key="settings" ref="management" module="settings" :me="me" @access-change="refresh" @busy="moduleBusy=$event"/>
   <StaffLookup v-else-if="activeModule==='lookup'" key="lookup" ref="management" module="lookup" :me="me" @access-change="refresh" @busy="moduleBusy=$event" @open-module="openModule"/>
   <StaffCustomers v-else-if="activeModule==='customers'" key="customers" ref="management" module="customers" :me="me" @access-change="refresh" @busy="moduleBusy=$event"/>
   <StaffManagementPanel v-else-if="activeModule&&activeModule!=='orders'" :key="activeModule" ref="management" :module="activeModule" :me="me" @access-change="refresh" @busy="moduleBusy=$event"/>
   <view v-else-if="state==='no-orders'" class="state-card inline">
    <text class="state-title">当前岗位没有已开放的手机管理权限</text>
    <text class="state-hint">请联系店长调整岗位权限，调整后下拉刷新即可。</text>
   </view>

   <template v-else>
    <view v-if="overviewError" class="notice" role="alert"><text>经营数据暂时没有加载出来：{{overviewError}}</text><button class="ui-button mini" :disabled="overviewLoading" @click="loadOverview">重试</button></view>
    <view v-if="cards.sales.length" class="sales-cards">
     <view v-for="card in cards.sales" :key="card.key" class="sales-card">
      <text class="card-label">{{card.label}}销售额</text>
      <text class="card-money">{{overview?card.sales:'—'}}</text>
      <text class="card-hint">{{overview?card.orders+' 笔付款订单':'正在统计…'}}</text>
     </view>
    </view>
    <text v-if="cards.sales.length" class="figure-note">按顾客付款统计（未扣退款），不含测试订单{{updatedAt?' · '+updatedAt+' 更新':''}}</text>

    <view class="todo-cards">
     <view v-for="t in cards.todo" :key="t.key" class="todo-card" :class="{active:view===t.view,muted:!allowed(t.view)}" @click="jump(t.view)">
      <text class="todo-value">{{overview?t.value:'—'}}</text><text class="todo-label">{{t.label}}</text>
     </view>
    </view>

    <view v-if="cards.cash.length" class="cash-card">
     <text class="cash-title">本月收款</text>
     <view class="cash-row"><view v-for="c in cards.cash" :key="c.key" class="cash-item"><text class="card-label">{{c.label}}</text><text class="cash-value">{{c.value}}</text></view></view>
     <text class="card-hint">实收是顾客实际付到店里的钱；退款单独列出；净收 = 实收 − 退款。</text>
    </view>

    <view class="tabs" :style="{top:navHeight+'px'}">
     <button v-for="t in tabs" :key="t.view" class="ui-button tab" :class="{active:view===t.view}" :aria-pressed="view===t.view" @click="selectView(t.view)">{{t.label}}<text v-if="t.count&&overview&&Number(overview[t.count])>0" class="tab-count">{{overview[t.count]>99?'99+':overview[t.count]}}</text></button>
    </view>

    <view v-if="listError" class="notice" role="alert"><text>{{listError}}</text><button class="ui-button mini" :disabled="listLoading" @click="loadList(false)">重新加载</button></view>
    <view v-if="!rows.length&&listLoading" class="list-tip">正在加载订单…</view>
    <view v-if="listLoaded&&!rows.length&&!listError&&!listLoading" class="empty"><text class="empty-title">{{empty.title}}</text><text class="state-hint">{{empty.hint}}</text></view>

    <view v-for="o in rows" :key="o.id" class="order">
     <view class="order-head"><text class="order-status">{{statusText(o)}}</text><text class="order-time">{{formatDate(o.paidAt||o.createdAt)}} {{o.paidAt?'付款':'下单'}}</text></view>
     <text class="order-no" selectable>订单号 {{o.orderNo}}</text>
     <view class="order-meta"><text>买家：{{o.buyerNickname||'商城顾客'}}</text><text>{{deliveryText(o)}}</text></view>
     <view class="order-items"><view v-for="(item,index) in o.items||[]" :key="index" class="order-item"><image v-if="item.image" class="item-image" :src="asset(item.image,160)" mode="aspectFit"/><view v-else class="item-image"/><view class="item-info"><text class="item-name">{{item.name}}</text><text class="item-spec">{{item.spec||'默认规格'}} × {{item.quantity}}</text><text v-if="item.refundedQuantity>0" class="item-spec refund-note">已退款 {{item.refundedQuantity}} 件{{['paid','shipping'].includes(o.status)?'，还需发 '+item.toShip+' 件':''}}</text></view></view></view>
     <view v-if="o.amount!==undefined&&o.amount!==null" class="order-amount"><text>实付金额</text><text class="amount">{{yuan(o.amount)}}<text v-if="o.refundedAmount>0" class="refund-note">（已退款 {{yuan(o.refundedAmount)}}）</text></text></view>
     <view v-if="hasRecipient(o)" class="recipient">
      <text class="recipient-title">{{o.deliveryMethod==='pickup'?'取货人':'收货人'}}</text>
      <view class="recipient-line"><text class="recipient-name">{{o.recipient.name||'未填写姓名'}}</text><text v-if="callable(o.recipient.phone)" class="phone" @click="call(o.recipient.phone)">{{o.recipient.phone}} · 拨打</text><text v-else-if="o.recipient.phone">{{o.recipient.phone}}</text></view>
      <text v-if="o.recipient.address&&o.deliveryMethod!=='pickup'" class="recipient-address" selectable>{{o.recipient.address}}</text>
     </view>
     <view v-if="o.afterSale" class="order-flag">售后：{{o.afterSale}}<button v-if="me.canViewCases&&!o.legacyAfterSale&&!o.afterSaleWaiting" class="ui-button mini" @click="chooseModule('cases')">处理售后</button></view>
     <text v-if="o.legacyAfterSale&&me.canViewCases" class="order-flag calm">旧版售后，请在电脑后台「售后处理」页下方的旧版售后记录里处理</text>
     <text v-if="o.afterSaleWaiting&&me.canViewCases" class="order-flag calm">已补发，等顾客确认收货（到期系统会自动确认），手机上不用处理</text>
     <text v-if="o.multiWarehouse&&me.canShip" class="order-flag calm">这张订单要从多个仓库分开发货，请在电脑后台「订单管理」里选仓库分批发货</text>
     <text v-if="pickupStatusText(o)" class="order-flag calm">{{pickupStatusText(o)}}</text>
     <text v-if="o.deliveryMethod==='pickup'&&store(o).name" class="order-line">自提门店：{{store(o).name}} {{store(o).address}}</text>
     <view v-if="o.tracking&&o.tracking.length" class="tracking"><text v-for="(t,index) in o.tracking" :key="index" class="order-line" selectable>已寄出：{{t.carrier}} {{t.tracking}}</text></view>
     <view v-if="canShipOrder(o,me,view)||canPrepareOrder(o,me,view)||canCollectOrder(o,me,view)" class="order-actions">
      <button v-if="canShipOrder(o,me,view)" class="ui-button primary" :disabled="!!busy" @click="openShip(o)">发货</button>
      <button v-if="canPrepareOrder(o,me,view)" class="ui-button primary" :loading="busy===o.id" :disabled="!!busy" @click="prepare(o)">备货完成</button>
      <button v-if="canCollectOrder(o,me,view)" class="ui-button primary" :disabled="!!busy" @click="openPickup(o)">核销自提</button>
     </view>
    </view>

    <button v-if="rows.length<total" class="ui-button load-more" :loading="listLoading" :disabled="listLoading" @click="loadMore">加载更多订单</button>
    <text v-else-if="rows.length" class="list-tip">已显示全部 {{total}} 笔订单</text>
   </template>
   </view>
  </template>

  <view v-if="refreshing&&state==='ok'&&!shipSheet&&!pickupSheet" class="refresh-bar" role="status">正在刷新订单…</view>

  <view v-if="shipSheet" class="overlay" @click="closeSheets">
   <view class="sheet" @click.stop>
    <text class="sheet-title">填写发货信息</text>
    <text class="sheet-hint">订单号 {{shipSheet.order.orderNo}}</text>
    <text v-if="hasRecipient(shipSheet.order)" class="sheet-hint">寄给 {{shipSheet.order.recipient.name}} {{shipSheet.order.recipient.address||''}}</text>
    <text class="form-label">物流公司</text>
    <input class="field" :value="shipSheet.carrier" :disabled="!!shipSheet.uncertain" maxlength="80" placeholder="例如 顺丰速运" @input="shipSheet.carrier=$event.detail.value;shipSheet.error=''"/>
    <view class="chips"><text v-for="c in carriers" :key="c" class="chip" :class="{on:c===shipSheet.carrier}" @click="pickCarrier(c)">{{c}}</text></view>
    <text class="form-label">运单号</text>
    <view class="field-row"><input class="field" :value="shipSheet.tracking" :disabled="!!shipSheet.uncertain" maxlength="100" placeholder="填写快递单上的运单号" @input="shipSheet.tracking=$event.detail.value;shipSheet.error=''"/><button v-if="isWechat" class="ui-button scan" :disabled="!!shipSheet.uncertain" @click="scanTracking">扫一扫</button></view>
    <text class="sheet-note">这张订单还没寄出的商品会全部记为已发货，顾客可以在订单里看到物流。需要分几次寄出时，请在电脑后台操作。</text>
    <text v-if="shipSheet.error" class="sheet-error" role="alert">{{shipSheet.error}}</text>
    <view class="sheet-actions"><button class="ui-button plain" :disabled="!!busy" @click="closeSheets">{{shipSheet.uncertain?'关闭':'取消'}}</button><button class="ui-button primary" :loading="!!busy" :disabled="!!busy||!!shipSheet.uncertain" @click="submitShip">{{shipSheet.uncertain?'请先核对订单状态':'确认发货'}}</button></view>
   </view>
  </view>

  <view v-if="pickupSheet" class="overlay" @click="closeSheets">
   <view class="sheet" @click.stop>
    <text class="sheet-title">核销自提</text>
    <text class="sheet-hint">订单号 {{pickupSheet.order.orderNo}}</text>
    <text v-if="hasRecipient(pickupSheet.order)" class="sheet-hint">取货人 {{pickupSheet.order.recipient.name}} {{pickupSheet.order.recipient.phone||''}}</text>
    <text class="form-label">顾客的自提码</text>
    <input class="field code-field" type="number" :value="pickupSheet.code" :disabled="!!pickupSheet.uncertain" maxlength="10" placeholder="请顾客打开订单出示8位自提码" @input="pickupSheet.code=$event.detail.value;pickupSheet.error=''"/>
    <text class="sheet-note">请先核对商品再核销。核销后这张订单会变成已完成。</text>
    <text v-if="pickupSheet.error" class="sheet-error" role="alert">{{pickupSheet.error}}</text>
    <view class="sheet-actions"><button class="ui-button plain" :disabled="!!busy" @click="closeSheets">{{pickupSheet.uncertain?'关闭':'取消'}}</button><button class="ui-button primary" :loading="!!busy" :disabled="!!busy||!!pickupSheet.uncertain" @click="submitPickup">{{pickupSheet.uncertain?'请先核对订单状态':'确认核销'}}</button></view>
   </view>
  </view>
 </view>
</template>
<script>
import UiIcon from '../../../components/UiIcon.vue'
import StaffModeSwitch from '../../../components/StaffModeSwitch.vue'
import StaffManagementPanel from './StaffManagementPanel.vue'
import StaffDashboard from './StaffDashboard.vue'
import StaffDistributors from './StaffDistributors.vue'
import StaffSettings from './StaffSettings.vue'
import StaffLookup from './StaffLookup.vue'
import StaffCustomers from './StaffCustomers.vue'
import {managementModules,menuDense} from '../services/staff-management'
import {request,getToken,notify,asset} from '../../../services/shop'
import {formatDate} from '../../../services/display'
import {switchToCustomerView} from '../../../services/staff-entry'
import {staffAccess,staffTabs,abilityText,overviewCards,emptyText,canShipOrder,canPrepareOrder,canCollectOrder,pickupStatusText,deliveryText,pickupStore,yuan,shipFormError,normalizeTracking,pickupCodeError,normalizePickupCode} from '../../../services/staff-workbench'

const LAST_CARRIER='shop-staff-carrier'
const STATUS={pending:'待付款',paid:'待发货',shipping:'部分发货',shipped:'待收货',completed:'已完成',cancelled:'已取消',refunded:'已退款'}
const ACCESS=/绑定|权限|无权/
const SIGNED_OUT=/请先登录|登录已过期|账号已停用/
const clock=()=>formatDate(new Date().toISOString()).slice(-5)
const SHIP_UNCERTAIN='网络不稳定，暂时不能确认是否已发货。订单列表已自动刷新：请关闭这里，看这张订单还在不在“待发货”里，还在的话再重新发货。'
const PICKUP_UNCERTAIN='网络不稳定，暂时不能确认是否已核销。订单列表已自动刷新：请关闭这里，看这张订单是否已完成，没完成的话再重新核销。'
const ask=(title,content,confirmText)=>new Promise(resolve=>uni.showModal({title,content,confirmText,cancelText:'再看看',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))

export default {
 components:{UiIcon,StaffModeSwitch,StaffManagementPanel,StaffDashboard,StaffDistributors,StaffSettings,StaffLookup,StaffCustomers},
 data(){return{
  activeModule:'orders',menuOpen:true,moduleBusy:false,isWechat:false,statusBar:0,capsule:0,canGoBack:false,
  state:'loading',me:null,loadError:'',generation:0,dataToken:'',
  overview:null,overviewError:'',overviewLoading:false,overviewSeq:0,updatedAt:'',
  view:'',rows:[],total:0,page:0,listLoading:false,listLoaded:false,listError:'',selection:0,reloadQueued:false,listJob:null,
  busy:false,refreshing:false,shipSheet:null,pickupSheet:null,
  carriers:['顺丰速运','中通快递','圆通速递','韵达快递','申通快递','极兔速递','京东快递','邮政EMS']
 }},
 computed:{
  modules(){return managementModules(this.me)},
  dense(){return menuDense(this.modules)},
  tabs(){return staffTabs(this.me)},
  cards(){return overviewCards(this.overview,this.me)},
  abilities(){return abilityText(this.me)},
  empty(){return emptyText(this.view)},
  navHeight(){return this.statusBar+48}
 },
 mounted(){
  // #ifdef MP-WEIXIN
  this.isWechat=true
  try{const rect=uni.getMenuButtonBoundingClientRect(),width=uni.getSystemInfoSync().windowWidth;if(rect&&rect.left)this.capsule=Math.max(0,width-rect.left+8)}catch{}
  // #endif
  try{this.statusBar=uni.getSystemInfoSync().statusBarHeight||0}catch{}
  this.canGoBack=getCurrentPages().length>1
  this.refresh()
 },
 methods:{
  formatDate,yuan,asset,deliveryText,canShipOrder,canPrepareOrder,canCollectOrder,pickupStatusText,
  store(o){return pickupStore(o)},
  statusText(o){return o.statusLabel||STATUS[o.status]||'处理中'},
  hasRecipient(o){const r=o?.recipient;return !!(r&&(r.name||r.phone||r.address))},
  callable(phone){return /^\+?[0-9][0-9-]{4,19}$/.test(String(phone||''))},
  allowed(view){return this.tabs.some(t=>t.view===view)},
  goBack(){uni.navigateBack({fail:()=>switchToCustomerView()})},
  toShop(){switchToCustomerView()},
  goLogin(){uni.setStorageSync('shop-return',{screen:'staff',query:{}});uni.navigateTo({url:'/pages/login/index'})},
  goBind(){uni.navigateTo({url:'/pages/settings/index?staffBind=1'})},

  // Jump from a 经营数据 to-do or an order's after-sale: only to modules (and order tabs) this person has.
  async openModule(target){
   const key=target?.module,view=target?.view
   if(this.busy||this.moduleBusy)return
   if(!this.modules.some(m=>m.key===key)){uni.showToast({title:'这类事项由有相应权限的同事处理',icon:'none'});return}
   if(key==='orders'&&view&&this.allowed(view)&&view!==this.view){this.view=view;this.selection++;this.rows=[];this.total=0;this.page=0;this.listLoaded=false;this.listError=''}
   await this.chooseModule(key)
  },
  async chooseModule(key){if(this.busy||this.moduleBusy||!this.modules.some(m=>m.key===key))return;this.activeModule=key;this.menuOpen=false;this.closeSheets(true);this.scrollToModule(key);if(key==='orders'&&this.state==='ok')await Promise.all([this.loadOverview(),this.loadList(false)])},
  // Keep the newly opened module visible below the sticky navigation on both H5 and WeChat.
  scrollToModule(key){this.$nextTick(()=>{
   if(this.activeModule!==key)return
   const query=uni.createSelectorQuery().in(this)
   query.select('#staff-module-content').boundingClientRect()
   query.selectViewport().scrollOffset()
   query.exec(result=>{if(this.activeModule!==key)return;const rect=result?.[0],viewport=result?.[1];if(rect&&viewport)uni.pageScrollTo({scrollTop:Math.max(0,rect.top+viewport.scrollTop-this.navHeight-8),duration:180})})
  })},
  showModuleMenu(){if(this.busy||this.moduleBusy)return;this.menuOpen=true;this.$nextTick(()=>uni.pageScrollTo({scrollTop:0,duration:180}))},
  async refresh(){
   const token=getToken()
   if(!token){this.enterLogin();return}
   // Another account signed in since this screen was loaded: drop the previous account's
   // orders, figures and forms (and its reads still in flight) before loading the new one.
   if(this.dataToken&&token!==this.dataToken)this.clearData('loading')
   const generation=++this.generation
   this.loadError=''
   if(!this.me)this.state='loading'
   let me
   try{me=await request('/staff/me')}
   catch(e){
    if(generation!==this.generation||e.staleSession||(getToken()&&token!==getToken()))return
    if(SIGNED_OUT.test(e.message||'')||!getToken()){this.enterLogin();return}
    if(this.state==='ok'||this.state==='no-orders')notify(e)
    else{this.state='error';this.loadError=e.message||'请检查网络后重试'}
    return
   }
   if(generation!==this.generation||token!==getToken())return
   this.dataToken=token
   this.applyMe(me)
   if(this.state==='ok'&&this.activeModule==='orders')await Promise.all([this.loadOverview(),this.loadList(false)]);else this.$nextTick(()=>this.$refs.management?.refresh())
  },
  // Returns true when the order tab on screen was taken away (another one is shown, still unloaded).
  applyMe(me){
   if(!this.dataToken)this.dataToken=getToken()
   this.me=me||{bound:false};this.state=staffAccess(this.me)
   // A removed module cannot release its lock after unmounting. A surviving module
   // must keep it, including catalog staff who have no order-view permission.
   if(!this.modules.some(m=>m.key===this.activeModule)){this.moduleBusy=false;this.activeModule=this.modules[0]?.key||''}
   if(this.state!=='ok'){if(this.state==='unbound')this.moduleBusy=false;this.overview=null;this.rows=[];this.total=0;this.listLoaded=false;this.closeSheets(true);return false}
   // A form for an action this role no longer has would only be refused: close it, unless its own write is running.
   if(!this.busy){if(this.shipSheet&&this.me.canShip!==true)this.shipSheet=null;if(this.pickupSheet&&this.me.canCollectPickup!==true)this.pickupSheet=null}
   if(this.allowed(this.view))return false
   this.view=this.tabs[0]?.view||'';this.selection++;this.rows=[];this.total=0;this.page=0;this.listLoaded=false
   return true
  },
  // Wording of refusals is the server's; the current state always comes from GET /staff/me.
  async accessChanged(e){
   if(!ACCESS.test(e?.message||''))return false
   try{
    const me=await request('/staff/me')
    // Another account signed in meanwhile: load everything for it instead of mixing its permissions into this screen.
    if(getToken()!==this.dataToken){this.refresh();return true}
    // The tab on screen was taken away: show the next one loaded instead of an empty list (never awaited here,
    // since this can run inside that list's own read).
    if(this.applyMe(me)&&this.state==='ok'&&this.activeModule==='orders')this.loadList(false)
    return this.state!=='ok'
   }catch{return this.loginLost()}
  },
  // Login ended while working (expired, or signed out elsewhere; shop.js has already cleared it):
  // show 请先登录 with the login button instead of a blank list or a bare error message.
  loginLost(){
   if(getToken())return false
   this.enterLogin()
   return true
  },
  enterLogin(){this.clearData('login')},
  clearData(state){
   // Remove private sheets as well as their underlying rows, and void the reads still in flight.
   // Keep an in-flight write's own busy lock until its finally block runs.
   this.generation++;this.selection++;this.reloadQueued=false;this.moduleBusy=false;this.me=null;this.dataToken='';this.state=state
   this.overview=null;this.overviewError='';this.rows=[];this.total=0;this.page=0;this.listLoaded=false;this.listError='';this.closeSheets(true)
  },
  // The orders and forms on screen belong to the account that loaded them. A write goes out only under
  // that same login: signed out → 请先登录; another account → say so and load that account, nothing is sent.
  sessionMoved(){
   const token=getToken()
   if(token&&token===this.dataToken)return false
   if(!token)this.enterLogin()
   else{this.closeSheets(true);uni.showToast({title:'登录状态已变化，请重新操作',icon:'none'});this.refresh()}
   return true
  },
  async loadOverview(){
   // 连续写入时几次统计可能同时在路上：只采用最后发出的那次，晚到的旧统计不能盖住新数字
   const token=getToken(),generation=this.generation,seq=++this.overviewSeq
   this.overviewLoading=true;this.overviewError=''
   try{
    const data=await request('/staff/overview')
    if(token!==getToken()||generation!==this.generation||seq!==this.overviewSeq)return
    this.overview=data||{};this.updatedAt=clock()
   }catch(e){
    if(this.loginLost()||e.staleSession||token!==getToken()||seq!==this.overviewSeq)return
    if(!await this.accessChanged(e))this.overviewError=e.message||'请稍后重试'
   }finally{if(seq===this.overviewSeq)this.overviewLoading=false}
  },
  // A reload asked for while a read is in flight runs right after that read. Callers that wait for it
  // (a write's lock) get the reload, which starts after their change and therefore shows it.
  loadList(more=false){
   if(!this.view)return Promise.resolve()
   if(this.listLoading){
    if(more)return this.listJob||Promise.resolve()
    this.reloadQueued=true
    return (this.listJob||Promise.resolve()).then(()=>this.listLoading?this.listJob:undefined)
   }
   this.listJob=this.fetchList(more)
   return this.listJob
  },
  async fetchList(more){
   const token=getToken(),selection=this.selection,next=more?this.page+1:1
   this.listLoading=true;this.listError=''
   try{
    const data=await request('/staff/orders?view='+encodeURIComponent(this.view)+'&page='+next+'&size=20')
    if(token!==getToken()||selection!==this.selection)return
    const rows=Array.isArray(data?.rows)?data.rows:[]
    this.rows=more?[...this.rows,...rows.filter(row=>!this.rows.some(old=>old.id===row.id))]:rows
    this.total=Number(data?.total)||0;this.page=next;this.listLoaded=true
   }catch(e){
    if(this.loginLost()||e.staleSession||token!==getToken()||selection!==this.selection)return
    if(!await this.accessChanged(e))this.listError='订单暂时没有加载出来：'+(e.message||'请重试')
   }finally{
    this.listLoading=false
    if(this.reloadQueued){this.reloadQueued=false;this.loadList(false)}
   }
  },
  // Reaching the bottom of the page pages the active list: orders here, or the module's own list (分销商).
  loadMore(){
   if(this.activeModule!=='orders'){this.$refs.management?.loadMore?.();return}
   if(this.state==='ok'&&this.rows.length<this.total&&!this.listLoading&&!this.listError)this.loadList(true)
  },
  selectView(view){
   if(view===this.view||!this.allowed(view))return
   this.view=view;this.selection++;this.rows=[];this.total=0;this.page=0;this.listLoaded=false;this.listError=''
   this.loadList(false)
  },
  jump(view){
   if(this.allowed(view))return this.selectView(view)
   uni.showToast({title:'这类订单由有相应权限的同事处理',icon:'none'})
  },
  // After a write the lock is held until the order list shows the new state ("正在刷新订单…" meanwhile).
  // The figures above refresh on their own: a slow statistics read must not hold the next order.
  reloadAfterWrite(){
   this.selection++;this.page=0;this.refreshing=true
   this.loadOverview()
   return this.loadList(false).finally(()=>{this.refreshing=false})
  },

  call(phone){
   uni.makePhoneCall({phoneNumber:String(phone),fail:e=>{if(!/cancel/i.test(e?.errMsg||''))uni.showToast({title:'请用手机拨打 '+phone,icon:'none',duration:3000})}})
  },
  closeSheets(force=false){if(this.busy&&force!==true)return;this.shipSheet=null;this.pickupSheet=null},
  openShip(o){
   if(this.busy)return
   let carrier=''
   try{carrier=uni.getStorageSync(LAST_CARRIER)||''}catch{}
   this.pickupSheet=null;this.shipSheet={order:o,carrier,tracking:'',error:'',uncertain:false}
  },
  pickCarrier(c){if(!this.shipSheet||this.shipSheet.uncertain)return;this.shipSheet.carrier=c;this.shipSheet.error=''},
  scanTracking(){
   uni.scanCode({scanType:['barCode','qrCode'],success:r=>{if(this.shipSheet&&!this.shipSheet.uncertain){this.shipSheet.tracking=normalizeTracking(r.result);this.shipSheet.error=''}},fail:e=>{if(!/cancel/i.test(e?.errMsg||''))uni.showToast({title:'没有识别到运单号，请手动填写',icon:'none'})}})
  },
  async submitShip(){
   const sheet=this.shipSheet
   if(!sheet||this.busy||sheet.uncertain)return
   const error=shipFormError(sheet)
   if(error){sheet.error=error;return}
   if(this.sessionMoved())return
   const carrier=String(sheet.carrier).trim(),tracking=normalizeTracking(sheet.tracking)
   this.busy=true;sheet.error=''
   try{
    if(!await ask('确认发货','物流公司：'+carrier+'\n运单号：'+tracking+'\n确认后顾客会在订单里看到物流信息。','确认发货'))return
    // The login can change while the confirm box is open (signed out, or another account in another tab).
    if(this.shipSheet!==sheet||this.sessionMoved())return
    await request('/staff/orders/'+sheet.order.id+'/ship','POST',{carrier,tracking})
    try{uni.setStorageSync(LAST_CARRIER,carrier)}catch{}
    if(this.shipSheet===sheet)this.shipSheet=null
    uni.showToast({title:'已发货',icon:'success'})
    await this.reloadAfterWrite()
   }catch(e){
    if(this.loginLost()||e.staleSession)return
    // 结果没收到：锁住这张表单（和售后、审核一样），不让在同一张表单上再点一次；列表已经自动刷新
    // 结果没收到：表单已锁住、不能再在同一张表单上提交，员工可以马上关闭；列表在后台刷新
    if(e.uncertain){sheet.uncertain=true;sheet.error=SHIP_UNCERTAIN;this.reloadAfterWrite();return}
    if(await this.accessChanged(e))return
    sheet.error=e.message||'发货没有成功，请重试'
   }finally{this.busy=false}
  },
  async prepare(o){
   if(this.busy||this.sessionMoved())return
   this.busy=o.id
   try{
    if(!await ask('备货完成','确认「'+o.orderNo+'」的商品已经备好？备好后顾客到店出示自提码就能取货。','已备好'))return
    if(this.sessionMoved())return
    await request('/staff/orders/'+o.id+'/prepare','POST',{})
    uni.showToast({title:'已标记备好',icon:'success'})
    await this.reloadAfterWrite()
   }catch(e){
    if(this.loginLost()||e.staleSession)return
    // 结果没收到：持锁到列表刷新完，刷新前这一行不能再点
    if(e.uncertain){notify(Error('网络不稳定，暂时不能确认是否已标记。订单列表已刷新，请看这张订单现在的状态。'));await this.reloadAfterWrite();return}
    if(await this.accessChanged(e))return
    notify(e)
   }finally{this.busy=false}
  },
  openPickup(o){
   if(this.busy)return
   this.shipSheet=null;this.pickupSheet={order:o,code:'',error:'',uncertain:false}
  },
  async submitPickup(){
   const sheet=this.pickupSheet
   if(!sheet||this.busy||sheet.uncertain)return
   const error=pickupCodeError(sheet.code)
   if(error){sheet.error=error;return}
   if(this.sessionMoved())return
   this.busy=true;sheet.error=''
   try{
    await request('/staff/pickup/collect','POST',{orderNo:sheet.order.orderNo,code:normalizePickupCode(sheet.code)})
    if(this.pickupSheet===sheet)this.pickupSheet=null
    uni.showToast({title:'核销完成',icon:'success'})
    await this.reloadAfterWrite()
   }catch(e){
    if(this.loginLost()||e.staleSession)return
    if(e.uncertain){sheet.uncertain=true;sheet.error=PICKUP_UNCERTAIN;this.reloadAfterWrite();return}
    if(await this.accessChanged(e))return
    sheet.error=e.message||'核销没有成功，请重试'
   }finally{this.busy=false}
  }
 }
}
</script>
<style scoped>
@import '../../../styles/component-base.css';
.bench{min-height:100vh;padding-bottom:calc(28px + env(safe-area-inset-bottom));background:var(--shop-background, #f3f8fb);color:var(--shop-text, #2b424f);font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC','Microsoft YaHei',sans-serif;font-size:14px;line-height:1.6;max-width:430px;margin:0 auto;box-sizing:border-box}
.bench-nav{position:sticky;top:0;z-index:30;background:var(--shop-surface, #fdfeff);border-bottom:1px solid var(--shop-border, #d5e6ee)}
.bench-nav-row{position:relative;height:48px;display:flex;align-items:center;padding:0 12px}
.nav-back{padding:8px;z-index:1}
.nav-title{position:absolute;left:64px;right:64px;text-align:center;font-size:16px;font-weight:600;pointer-events:none}
button{margin:0;font-size:14px;font-weight:500}
button::after{border:0}
.primary{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c)}
.primary[disabled]{background:var(--shop-disabled, #dfebf1)!important;color:var(--shop-muted, #59727f)!important}
.plain{background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}
.mini{min-height:36px;padding:6px 12px;font-size:13px;background:#fdf9f4;color:#875f3d;flex-shrink:0}
.state-card{margin:40px 16px;padding:28px 20px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px;display:flex;flex-direction:column;gap:12px;text-align:center}
.state-title{font-size:18px;font-weight:600;line-height:1.5}
.state-hint{display:block;font-size:13px;line-height:1.8;color:var(--shop-muted, #59727f)}
.state-card>button{width:100%}
.state-card.inline{margin:12px}
.who{margin:12px 12px 0;padding:18px 16px;background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);border-radius:12px}
.who-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.who-name{font-size:20px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
.who-role{font-size:12px;padding:2px 9px;border-radius:12px;background:rgba(255,255,255,.16);color:var(--shop-ink, #28546c);white-space:nowrap}
.who-abilities{display:block;font-size:12px;color:var(--shop-ink, #28546c);margin-top:6px;line-height:1.7}
.switch{margin-top:14px;width:100%;min-height:42px;background:var(--shop-background, #f3f8fb);color:var(--shop-text, #2b424f);font-weight:600}
.notice{display:flex;align-items:center;gap:10px;margin:12px 12px 0;padding:12px 14px;background:#faf0e7;color:#875f3d;font-size:13px;line-height:1.7;border-radius:8px}
.notice>text{flex:1;min-width:0;overflow-wrap:anywhere}
.sales-cards{display:flex;gap:10px;margin:12px 12px 0}
.sales-card{flex:1;min-width:0;padding:14px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px}
.card-label{display:block;font-size:12px;color:var(--shop-muted, #59727f)}
.card-money{display:block;font-size:20px;font-weight:600;color:var(--shop-text, #2b424f);margin-top:4px;line-height:1.4;overflow-wrap:anywhere}
.card-hint{display:block;font-size:12px;color:var(--shop-muted, #59727f);line-height:1.7;margin-top:2px}
.figure-note{display:block;margin:6px 14px 0;font-size:11px;color:var(--shop-muted, #59727f);line-height:1.7}
.todo-cards{display:flex;gap:8px;margin:12px 12px 0}
.todo-card{flex:1;min-width:0;padding:12px 6px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px;text-align:center}
.todo-card.active{border-color:var(--shop-control, #417c9a);background:var(--shop-background, #f3f8fb)}
.todo-card.muted{opacity:.7}
.todo-value{display:block;font-size:22px;font-weight:600;line-height:1.3;color:var(--shop-text, #2b424f)}
.todo-label{display:block;font-size:12px;color:var(--shop-ink, #28546c);margin-top:2px}
.cash-card{margin:12px 12px 0;padding:14px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px}
.cash-title{display:block;font-size:14px;font-weight:600}
.cash-row{display:flex;gap:8px;margin:8px 0 4px}
.cash-item{flex:1;min-width:0}
.cash-value{display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere;line-height:1.5}
.tabs{position:sticky;z-index:20;display:flex;margin:14px 0 0;padding:0 8px;background:var(--shop-background, #f3f8fb);border-bottom:1px solid var(--shop-border, #d5e6ee)}
.tab{flex:1;min-width:0;min-height:46px;padding:10px 2px;border-radius:0;background:transparent;color:var(--shop-ink, #28546c);font-size:14px;line-height:1.4;white-space:nowrap}
.tab.active{color:var(--shop-text, #2b424f);font-weight:600;border-bottom:2px solid var(--shop-control, #417c9a)}
.tab-count{display:inline-block;margin-left:3px;min-width:16px;padding:0 5px;border-radius:9px;background:#a8593a;color:#fff;font-size:11px;line-height:17px;font-weight:500}
.list-tip{display:block;text-align:center;font-size:13px;color:var(--shop-muted, #59727f);padding:22px 8px}
.refresh-bar{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:110;padding:8px 16px;border-radius:999px;background:rgba(31,45,52,.86);color:#fff;font-size:13px;line-height:18px;white-space:nowrap;pointer-events:none}
.empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:44px 24px;text-align:center}
.empty-title{font-size:16px;font-weight:600}
.order{margin:12px;padding:14px;background:var(--shop-surface, #fdfeff);border:1px solid var(--shop-border, #d5e6ee);border-radius:10px}
.order-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.order-status{font-size:15px;font-weight:600;color:var(--shop-text, #2b424f)}
.order-time{font-size:12px;color:var(--shop-muted, #59727f);white-space:nowrap}
.order-no{display:block;font-size:12px;color:var(--shop-muted, #59727f);margin-top:2px;overflow-wrap:anywhere}
.order-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--shop-ink, #28546c);margin-top:6px}
.order-items{margin-top:8px;border-top:1px solid var(--shop-border, #d5e6ee)}
.order-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--shop-border, #d5e6ee)}
.item-image{width:44px;height:52px;border-radius:5px;background:var(--shop-background, #f3f8fb);flex-shrink:0}
.item-info{flex:1;min-width:0;display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;align-items:baseline}
.item-name{flex:1;min-width:0;font-size:14px;overflow-wrap:anywhere}
.order-flag{display:block;margin-top:8px;padding:6px 10px;border-radius:6px;background:#fbf1e8;color:#9a5d37;font-size:12px;line-height:1.7}
.order-flag.calm{background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}
.item-spec{font-size:12px;color:var(--shop-muted, #59727f);white-space:nowrap}.refund-note{font-size:12px;color:#b54708;white-space:normal;flex-basis:100%}
.order-amount{display:flex;justify-content:space-between;align-items:baseline;padding-top:10px;font-size:13px;color:var(--shop-ink, #28546c)}
.amount{font-size:17px;font-weight:600;color:var(--shop-text, #2b424f)}
.recipient{margin-top:10px;padding:10px 12px;background:var(--shop-background, #f3f8fb);border-radius:8px}
.recipient-title{display:block;font-size:12px;color:var(--shop-muted, #59727f)}
.recipient-line{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:14px}
.recipient-name{font-weight:600}
.phone{color:var(--shop-ink, #28546c);text-decoration:underline;padding:4px 0}
.recipient-address{display:block;font-size:13px;line-height:1.7;color:var(--shop-ink, #28546c);overflow-wrap:anywhere}
.order-line{display:block;font-size:12px;color:var(--shop-ink, #28546c);line-height:1.8;margin-top:6px;overflow-wrap:anywhere}
.order-actions{display:flex;gap:10px;margin-top:12px}
.order-actions>button{flex:1}
.load-more{margin:6px 12px 0;background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}
.overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
.sheet{width:100%;max-width:430px;max-height:88vh;overflow-y:auto;background:var(--shop-surface, #fdfeff);border-radius:16px 16px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom));box-sizing:border-box}
.sheet-title{display:block;font-size:18px;font-weight:600;margin-bottom:6px}
.sheet-hint{display:block;font-size:13px;color:var(--shop-muted, #59727f);line-height:1.7;overflow-wrap:anywhere}
.form-label{display:block;margin:16px 0 8px;font-size:13px;font-weight:600}
.field{width:100%;height:46px;padding:0 12px;background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:6px}
.code-field{font-size:20px;letter-spacing:4px}
.field-row{display:flex;gap:8px;align-items:center}
.field-row>.field{flex:1}
.scan{flex-shrink:0;min-height:46px;background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.chip{padding:6px 10px;border-radius:14px;background:var(--shop-background, #f3f8fb);color:var(--shop-ink, #28546c);font-size:12px;line-height:1.4}
.chip.on{background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c)}
.sheet-note{display:block;margin-top:12px;font-size:12px;color:var(--shop-muted, #59727f);line-height:1.8}
.sheet-error{display:block;margin-top:10px;padding:10px 12px;background:#faf0e7;color:#875f3d;font-size:13px;line-height:1.7;border-radius:6px}
.sheet-actions{display:flex;gap:10px;margin-top:16px}
.sheet-actions>button{flex:1}
.management-menu{display:flex;flex-wrap:wrap;gap:8px;padding:12px 12px}.management-menu button{width:calc((100% - 24px)/4);min-width:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;padding:13px 2px;background:var(--shop-surface,#fdfeff);border:1px solid var(--shop-border,#d5e6ee);border-radius:10px;margin:0;font-size:12px;color:var(--shop-ink,#28546c);line-height:1.5}.management-menu button.selected{background:var(--shop-accent,#c7e8f5);border-color:var(--shop-control,#417c9a)}
.management-menu.dense button{padding:9px 2px;gap:4px}
.module-back{margin:8px 12px 0;padding:10px 0;min-height:44px;background:transparent;text-align:left;font-size:14px;line-height:1.7;color:var(--shop-ink,#28546c)}.module-back::after{border:0}
</style>
