<template>
 <view class="module-panel customers">
  <template v-if="view==='list'">
   <view class="panel-heading"><view><text class="panel-title">{{info.title}}</text><text class="hint">{{hint}}</text></view><button class="small-button" :disabled="loading||busy" @click="refresh">刷新</button></view>
   <view class="search-row"><input v-model="q" confirm-type="search" maxlength="40" placeholder="姓名、昵称、手机号、尾号或 #会员编号" aria-label="搜索客户" @confirm="search"/><button class="small-button" :disabled="loading" @click="search">查询</button></view>
   <view class="choices filters"><button v-for="f in filters" :key="f.key" :class="{chosen:filter===f.key}" :aria-pressed="filter===f.key" @click="setFilter(f.key)">{{f.label}}</button></view>
   <view class="choices sorts"><text class="sort-label">排序</text><button v-for="s in sorts" :key="s.key" :class="{chosen:sort===s.key}" :aria-pressed="sort===s.key" @click="setSort(s.key)">{{s.label}}</button></view>
   <text v-if="loaded" class="hint">{{searched?'找到 '+total+' 位':'共 '+total+' 位客户'}}</text>
   <text v-if="error" class="error" role="alert">{{error}}</text>
   <view v-if="loading&&!loaded" class="empty">正在读取…</view>
   <view v-else-if="!loaded" class="empty">数据尚未读取成功，请点击上方刷新重试。</view>
   <view v-else-if="!rows.length" class="empty">{{searched?'没有找到匹配的客户，换个关键词试试':filter!=='all'?'这个筛选下暂时没有客户':'还没有客户'}}</view>
   <view v-for="r in rows" :key="r.memberId" class="record customer-row" role="button" @click="openDetail(r)">
    <view class="line row-head"><text class="record-title">{{displayName(r)}}</text><view class="tags"><text class="tag" :class="{warn:r.segment==='buying'}">{{segmentText(r)}}</text><text v-if="r.enabled===false" class="tag warn">账号已停用</text></view></view>
    <text class="hint">会员编号 {{r.memberId}} · {{phoneLine(r)}}</text>
    <text class="hint">{{identityLine(r)}}{{r.companyName?' · '+r.companyName:''}}</text>
    <text class="hint">{{lastPaidText(r)}}</text>
    <text v-if="showMoney" class="hint strong-line">{{rowMoneyText(r)}}</text>
   </view>
   <button v-if="loaded&&rows.length<total" class="secondary" :loading="loading" :disabled="loading" @click="loadList(true)">加载更多（已显示 {{rows.length}} / 共 {{total}} 位）</button>
   <text v-else-if="rows.length" class="hint all-shown">已显示全部 {{total}} 位</text>
  </template>

  <template v-else-if="view==='detail'">
   <button class="text-button" :disabled="busy" @click="backToList">‹ 返回列表</button>
   <text v-if="detailError" class="error" role="alert">{{detailError}}</text>
   <button v-if="detailError" class="secondary" :disabled="detailLoading" @click="loadDetail">重新读取</button>
   <view v-if="detailLoading&&!detail" class="empty">正在读取…</view>
   <template v-if="detail&&member">
    <view class="accent-block">
     <text class="record-title">{{displayName(member)}}</text>
     <text class="block-line">会员编号 {{member.memberId}}</text>
     <text v-if="!member.phone" class="block-line">未留手机号</text>
     <text v-else-if="callablePhone(member.phone)" class="block-line phone" @click="call(member.phone)">{{member.phone}} · 拨打</text>
     <text v-else class="block-line">{{member.phone}}</text>
     <text v-if="member.nickname&&member.nickname!==displayName(member)" class="block-line">微信昵称 {{member.nickname}}</text>
     <text class="block-line">注册时间 {{timeText(member.createdAt)}}</text>
     <view class="tags left"><text class="tag">{{segmentText(detail)}}</text><text class="tag">{{identityLine(member)}}</text><text v-if="member.enabled===false" class="tag warn">账号已停用</text></view>
     <text v-if="member.companyName" class="block-line">企业：{{member.companyName}}</text>
    </view>

    <template v-if="hasMoney">
     <text class="section-label">余额</text>
     <view class="money-lines">
      <view v-for="line in walletRows" :key="line.key" :class="{strong:line.key==='store'}"><text>{{line.label}}</text><text>{{moneyText(line.value)}}</text></view>
     </view>
     <text class="hint">门店余额是在店里付款、由店长或财务登记的充值，客户下单时打开「使用门店余额」抵扣。</text>
     <text v-if="detail.storeBalanceUsable===false" class="notice-block">{{storeBalanceOff}}</text>
    </template>
    <text v-else class="hint money-hidden">余额和充值记录只有店长和财务能看到。</text>

    <template v-if="me.canTopUpCustomers===true">
     <button v-if="actions.canTopUp===true" class="primary topup-button" :disabled="busy" @click="openTopup">给客户充值</button>
     <text v-else-if="actions.topUpBlocked" class="notice-block">{{actions.topUpBlocked}}</text>
     <text v-if="pendingHere" class="notice-block">有一笔充值结果还没确认，点「给客户充值」核对后再处理。</text>
    </template>
    <template v-if="me.canRefundStoreBalance===true&&actions.canRefund===true&&hasMoney">
     <button v-if="storeAvailable>0||pendingRefundHere" class="secondary refund-button" :disabled="busy" @click="openRefund">门店余额退款</button>
     <text v-if="pendingRefundHere" class="notice-block">有一笔退款结果还没确认，点「门店余额退款」核对后再处理。</text>
    </template>

    <template v-if="hasMoney">
     <text class="section-label">门店充值记录</text>
     <view v-for="t in topups" :key="t.id" class="record topup-record">
      <view class="line"><text class="strong">{{moneyText(t.amount)}} · {{t.methodLabel||methodName(t.method,methodList)}}</text><text class="tag" :class="{off:t.state!=='valid'}">{{topupStateText(t)}}</text></view>
      <text v-if="t.reference" class="hint" selectable>{{t.method==='bank'?'银行流水号':'流水号/说明'}} {{t.reference}}</text>
      <text v-if="t.note" class="hint">备注：{{t.note}}</text>
      <text class="hint">登记：{{t.createdBy}} · {{timeText(t.createdAt)}}</text>
      <text v-if="t.state!=='valid'" class="hint warn-note">作废：{{t.voidedBy}} · {{timeText(t.voidedAt)}} · 原因：{{t.voidReason}}</text>
      <button v-if="canVoid&&t.state==='valid'" class="small-button action" :disabled="busy" @click="openVoid(t)">作废</button>
     </view>
     <view v-if="!topups.length" class="empty">还没有门店充值记录</view>
     <text v-if="topups.length>=30" class="hint">这里只显示最近 30 条，更早的请在电脑后台「客户余额 → 门店充值」里输入会员编号 {{member.memberId}} 查找。</text>
     <text class="section-label">门店余额退款记录</text>
     <view v-for="r in refunds" :key="'r'+r.id" class="record refund-record">
      <view class="line"><text class="strong">退 {{moneyText(r.amount)}} · {{r.methodLabel||methodName(r.method,methodList)}}</text></view>
      <text v-if="r.reference" class="hint" selectable>{{r.method==='bank'?'银行流水号':'流水号/说明'}} {{r.reference}}</text>
      <text class="hint">原因：{{r.reason}}</text>
      <text class="hint">登记：{{r.createdBy}} · {{timeText(r.createdAt)}}</text>
     </view>
     <view v-if="!refunds.length" class="empty">还没有门店余额退款</view>
    </template>

    <text class="section-label">最近订单</text>
    <view v-for="o in orders" :key="'o'+o.orderId" class="record order-row">
     <view class="line"><text class="strong">{{o.statusLabel||'处理中'}}</text><text>{{moneyText(o.amount)}}</text></view>
     <text class="hint" selectable>订单号 {{o.orderNo}}</text>
     <text class="hint">{{timeText(o.paidAt||o.createdAt)}} {{o.paidAt?'付款':'下单'}}{{o.isTest?' · 测试':''}}</text>
     <text v-if="o.itemsText" class="hint">{{o.itemsText}}</text>
    </view>
    <view v-if="!orders.length" class="empty">还没有订单</view>
    <text v-if="orderTotal>orders.length" class="hint">只显示最近 {{orders.length}} 笔，共 {{orderTotal}} 笔。</text>
    <text v-if="orders.length" class="hint">订单详情可以在「客户订单」里按订单号查。</text>
   </template>
  </template>

  <template v-else-if="view==='editor'&&editor&&detail">
   <view class="editor">
    <button class="text-button" :disabled="busy" @click="closeEditor">‹ 返回档案</button>
    <text class="editor-title">{{editorTitle}}</text>
    <text class="hint">{{memberLabel(member)}}</text>

    <template v-if="editor.kind==='topup'">
     <text class="label">充值金额（元）</text><input type="digit" v-model="editor.amount" :disabled="locked" placeholder="例如 5000"/>
     <text class="label">收款方式</text>
     <view class="choices"><button v-for="m in methodList" :key="m.key" :class="{chosen:editor.method===m.key}" :disabled="locked" @click="editor.method=m.key">{{m.label}}</button></view>
     <text class="label">{{editor.method==='bank'?'银行流水号（必填）':'流水号或收款说明（选填）'}}</text><input v-model="editor.reference" :disabled="locked" maxlength="120" :placeholder="editor.method==='bank'?'银行回单上的流水号':'例如 收据号、转账单号'"/>
     <text class="label">备注（选填）</text><textarea v-model="editor.note" :disabled="locked" maxlength="300" auto-height placeholder="例如 拿货预存"/>
     <view class="accent-block">{{afterTopupText(detail.money&&detail.money.wallet,topupFen)}}</view>
     <text v-if="duplicate" class="notice-block">{{duplicate}}</text>
     <text v-if="detail.storeBalanceUsable===false" class="notice-block">{{storeBalanceOff}}</text>
     <text class="hint">登记即到账，不需要另一个人确认。只登记已经收到的钱；登记错了请店长作废：只能整笔作废，而且客户的门店余额里还有这么多（没用掉、也没被待付款订单占用）。</text>
    </template>

    <template v-if="editor.kind==='void'">
     <view class="money-lines"><view><text>金额</text><text>{{moneyText(editor.topup.amount)}}</text></view><view><text>收款方式</text><text>{{editor.topup.methodLabel||methodName(editor.topup.method,methodList)}}</text></view><view><text>登记时间</text><text>{{timeText(editor.topup.createdAt)}}</text></view><view><text>登记人</text><text>{{editor.topup.createdBy}}</text></view></view>
     <text class="label">作废原因</text><textarea v-model="editor.reason" :disabled="locked" maxlength="300" placeholder="例如 金额填错、重复登记"/>
     <text class="notice-block">作废后从客户的门店余额扣回这笔钱，不能恢复。客户已经用掉一部分（或被待付款订单占用）时不能作废。</text>
     <text class="hint">作废原因只留在店里的记录里；客户的余额明细只显示“门店充值登记有误，已更正”。</text>
    </template>

    <template v-if="editor.kind==='refund'">
     <view class="accent-block">现在能退的门店余额 {{moneyText(storeAvailable)}}（被待付款订单占用的不能退）</view>
     <text class="label">退款金额（元）</text><input type="digit" v-model="editor.amount" :disabled="locked" :placeholder="'最多 '+moneyText(storeAvailable)"/>
     <text class="label">退款方式</text>
     <view class="choices"><button v-for="m in methodList" :key="m.key" :class="{chosen:editor.method===m.key}" :disabled="locked" @click="editor.method=m.key">{{m.label}}</button></view>
     <text class="label">{{editor.method==='bank'?'银行流水号（必填）':'流水号或退款说明（选填）'}}</text><input v-model="editor.reference" :disabled="locked" maxlength="120" :placeholder="editor.method==='bank'?'退款回单上的流水号':'例如 现金当面退回'"/>
     <text class="label">退款原因</text><textarea v-model="editor.reason" :disabled="locked" maxlength="300" auto-height placeholder="例如 客户不再拿货，退回剩下的预存"/>
     <text v-if="duplicate" class="notice-block">{{duplicate}}</text>
     <text class="notice-block">只登记已经退给客户的钱。登记后客户的门店余额减少，不能撤销；{{member&&member.enabled===false?'这位客户已停用，登记错了要先在电脑后台恢复这位客户，再充值补回':'登记错了请再给客户充值补回'}}。收款报表里计作退款。</text>
    </template>

    <text v-if="formError" class="error" role="alert">{{formError}}</text>
    <text v-if="uncertain" class="notice">{{uncertainText}}</text>
    <button v-if="resendable" class="primary" :loading="busy" :disabled="busy" @click="submit">{{uncertain?'原样重新提交':editor.kind==='topup'?'确认充值':'确认退款'}}</button>
    <button v-else class="primary" :loading="busy" :disabled="busy||uncertain" @click="submit">{{uncertain?'请先核对最新状态':'确认作废'}}</button>
    <button v-if="uncertain" class="secondary" :disabled="busy" @click="closeAndCheck">返回档案核对</button>
    <button v-if="resendable&&(uncertain||pendingOf(editor.kind)&&pendingOf(editor.kind).editor===editor)" class="text-button drop" :disabled="busy" @click="dropPending">放弃这次内容</button>
   </view>
  </template>
 </view>
</template>
<script>
import {request,getToken} from '../../../services/shop'
import {MANAGEMENT_MODULES,moduleHint} from '../services/staff-management'
import {money,filtersFor,sortsFor,listQuery,searchProblem,displayName,segmentText,identityLine,phoneLine,callablePhone,timeText,lastPaidText,rowMoneyText,balanceLines,methodsOf,methodName,newTopupRequestKey,readTopupForm,topupYuanToFen,memberLabel,topupConfirmText,topupRetryConfirmText,voidConfirmText,readVoidForm,newRefundRequestKey,readRefundForm,refundConfirmText,refundRetryConfirmText,recentDuplicate,recentRefundDuplicate,afterTopupText,topupStateText,STORE_BALANCE_OFF,CUSTOMER_UNCERTAIN,CUSTOMER_DONE} from '../services/staff-customers'
const ACCESS=/绑定|权限|无权|登录/
const ask=(title,content,confirmText)=>new Promise(resolve=>uni.showModal({title,content,confirmText,cancelText:'再看看',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))
export default {
 props:{module:{required:true},me:{required:true}},
 emits:['access-change','busy'],
 data(){return{view:'list',q:'',searched:'',filter:'all',sort:'recent',rows:[],total:0,page:0,loaded:false,loading:false,error:'',sequence:0,selection:0,listStale:false,
  detailId:0,detail:null,detailLoading:false,detailError:'',detailSeq:0,
  editor:null,formError:'',uncertain:false,busy:false,pendingTopup:null,pendingRefund:null,storeBalanceOff:STORE_BALANCE_OFF}},
 computed:{
  info(){return MANAGEMENT_MODULES.find(m=>m.key===this.module)||{}},
  hint(){return moduleHint(this.info,this.me)},
  filters(){return filtersFor(this.me)},
  sorts(){return sortsFor(this.me)},
  showMoney(){return this.me.canViewMoney===true},
  member(){return this.detail?.member||null},
  hasMoney(){return !!this.detail?.money},
  walletRows(){return balanceLines(this.detail?.money?.wallet)},
  actions(){return this.detail?.actions||{}},
  canVoid(){return this.me.canVoidTopUps===true&&this.actions.canVoid===true},
  topups(){return Array.isArray(this.detail?.topups)?this.detail.topups:[]},
  refunds(){return Array.isArray(this.detail?.refunds)?this.detail.refunds:[]},
  // 现在能退的门店余额 = 门店余额里能用的部分（被待付款订单占用的已经扣出，不在里面）
  storeAvailable(){return Number(this.detail?.money?.wallet?.legacy?.available)||0},
  methodList(){return methodsOf(this.detail)},
  orders(){return Array.isArray(this.detail?.orders?.rows)?this.detail.orders.rows:[]},
  orderTotal(){return Number(this.detail?.orders?.total)||0},
  locked(){return this.busy||this.uncertain},
  topupFen(){try{return this.editor?.kind==='topup'?topupYuanToFen(this.editor.amount):0}catch{return 0}},
  refundFen(){try{return this.editor?.kind==='refund'?topupYuanToFen(this.editor.amount):0}catch{return 0}},
  // 充值、门店余额退款都提醒 10 分钟内同样金额的登记（结果不确定、放弃后再登记时尤其要看；第 16 批补缺口 C16）
  duplicate(){if(this.uncertain)return '';if(this.editor?.kind==='topup')return recentDuplicate(this.topups,this.topupFen,Date.now());if(this.editor?.kind==='refund')return recentRefundDuplicate(this.refunds,this.refundFen,Date.now());return ''},
  pendingHere(){return this.pendingTopup?.memberId===this.detailId},
  pendingRefundHere(){return this.pendingRefund?.memberId===this.detailId},
  editorTitle(){return ({topup:'给客户充值',void:'作废门店充值',refund:'门店余额退款'})[this.editor?.kind]||''},
  resendable(){return this.editor?.kind==='topup'||this.editor?.kind==='refund'},
  uncertainText(){return CUSTOMER_UNCERTAIN[this.editor?.kind]||''}
 },
 mounted(){this.loadList(false)},
 beforeUnmount(){this.sequence++;this.detailSeq++},
 methods:{
  displayName,segmentText,identityLine,phoneLine,callablePhone,timeText,lastPaidText,rowMoneyText,methodName,memberLabel,afterTopupText,topupStateText,
  moneyText:money,
  refresh(){if(this.busy||this.view==='editor')return;if(this.view==='detail')return this.loadDetail();return this.loadList(false)},
  // 登录已被清掉（例如“账号已停用”，shop.js 已清本地登录）时，文案里不一定有关键词，也要让父页面回到登录。
  fail(e){if(e.staleSession)return;this.error=e.message||'暂时读取不到，请重试';if(ACCESS.test(this.error)||!getToken())this.$emit('access-change')},
  search(){const q=this.q.trim(),p=searchProblem(q);if(p){this.error=p;return}this.searched=q;this.selection++;this.loadList(false)},
  setFilter(key){if(key===this.filter)return;this.filter=key;this.selection++;this.loadList(false)},
  setSort(key){if(key===this.sort)return;this.sort=key;this.selection++;this.loadList(false)},
  // A page is kept only when it arrives for the current search, filter and order; a failed page leaves the list as it was.
  async loadList(more){
   if(more&&(this.loading||this.rows.length>=this.total))return
   const sel=this.selection,seq=++this.sequence,next=more?this.page+1:1
   this.loading=true;this.error=''
   try{const r=await request('/staff/manage/customers?'+listQuery({q:this.searched,filter:this.filter,sort:this.sort,page:next}))
    if(seq!==this.sequence||sel!==this.selection)return
    const got=Array.isArray(r?.rows)?r.rows:[]
    this.rows=more?[...this.rows,...got.filter(x=>!this.rows.some(o=>o.memberId===x.memberId))]:got
    this.total=Number(r?.total)||0;this.page=next;this.loaded=true;this.listStale=false}
   catch(e){if(seq===this.sequence&&sel===this.selection)this.fail(e)}
   finally{if(seq===this.sequence)this.loading=false}
  },
  // 页面滑到底时由工作台调用（与分销商页一致）
  loadMore(){if(this.view==='list'&&this.loaded&&!this.loading&&!this.error&&this.rows.length<this.total)this.loadList(true)},
  openDetail(r){if(this.busy)return;this.detailId=r.memberId;this.detail=null;this.view='detail';this.loadDetail();uni.pageScrollTo({scrollTop:0,duration:0})},
  async loadDetail(){
   const seq=++this.detailSeq,id=this.detailId;this.detailLoading=true;this.detailError=''
   try{const r=await request('/staff/manage/customers/'+id);if(seq!==this.detailSeq)return;this.detail=r}
   catch(e){if(seq!==this.detailSeq||e.staleSession)return;this.detailError=e.message||'暂时读取不到，请重试';if(ACCESS.test(this.detailError)||!getToken())this.$emit('access-change')}
   finally{if(seq===this.detailSeq)this.detailLoading=false}
  },
  backToList(){if(this.busy)return;this.view='list';this.detail=null;this.detailSeq++;this.detailLoading=false;if(this.listStale)this.loadList(false)},
  begin(){this.view='editor';this.formError='';this.uncertain=false;uni.pageScrollTo({scrollTop:0,duration:0})},
  openTopup(){
   if(this.busy||!this.detail||this.actions.canTopUp!==true)return
   if(this.pendingHere){this.editor=this.pendingTopup.editor;this.view='editor';this.formError='';this.uncertain=true;uni.pageScrollTo({scrollTop:0,duration:0});return}
   this.editor={kind:'topup',amount:'',method:'cash',reference:'',note:'',requestKey:newTopupRequestKey(),sentBody:null}
   this.begin()
  },
  openVoid(t){if(this.busy||!this.canVoid)return;this.editor={kind:'void',topup:t,reason:''};this.begin()},
  openRefund(){
   if(this.busy||!this.detail||this.actions.canRefund!==true||this.me.canRefundStoreBalance!==true)return
   if(this.pendingRefundHere){this.editor=this.pendingRefund.editor;this.view='editor';this.formError='';this.uncertain=true;uni.pageScrollTo({scrollTop:0,duration:0});return}
   if(!(this.storeAvailable>0))return
   this.editor={kind:'refund',amount:'',method:'cash',reference:'',reason:'',requestKey:newRefundRequestKey(),sentBody:null}
   this.begin()
  },
  pendingOf(kind){return kind==='refund'?this.pendingRefund:kind==='topup'?this.pendingTopup:null},
  setPending(kind,value){if(kind==='refund')this.pendingRefund=value;else if(kind==='topup')this.pendingTopup=value},
  // 充值、退款的结果没收到时原样重发（同一个请求号，服务器不会重复记账）；作废的结果没收到先回档案核对。
  // 充值时同一个银行流水号已登记成加盟款或对公收款：服务器先答复“请确认”（这次什么都没登记），店长看过说明、确认后带确认再提交一次（店主 10-05）。
  async submit(){
   if(this.busy||!this.editor)return
   const editor=this.editor,resend=editor.kind==='topup'||editor.kind==='refund',retry=this.uncertain&&resend
   if(this.uncertain&&!retry)return
   let body
   if(retry)body=editor.sentBody
   else{const r=editor.kind==='topup'?readTopupForm(editor,this.methodList):editor.kind==='refund'?readRefundForm(editor,this.methodList,this.storeAvailable):readVoidForm(editor);if(r.error){this.formError=r.error;return}body=r.body}
   if(!body)return
   const token=getToken(),member=this.member,memberId=this.detailId
   const path=editor.kind==='topup'?'customers/'+memberId+'/topups':editor.kind==='refund'?'customers/'+memberId+'/store-refunds':'topups/'+editor.topup.id+'/void'
   const text=retry?(editor.kind==='refund'?refundRetryConfirmText(body):topupRetryConfirmText(body)):editor.kind==='topup'?topupConfirmText(member,body,this.methodList):editor.kind==='refund'?refundConfirmText(member,body,this.methodList):voidConfirmText(member,editor.topup)
   this.busy=true;this.$emit('busy',true);this.formError=''
   let fresh=null
   try{
    if(!await ask(this.editorTitle,text,retry?'确认提交':({topup:'确认充值',refund:'确认退款',void:'确认作废'})[editor.kind]))return
    // 确认框打开期间退出或换了账号：不提交，由父页面按现在的登录重新加载
    if(token!==getToken()){this.$emit('access-change');return}
    if(resend&&!retry)editor.sentBody=JSON.parse(JSON.stringify(body))
    let result=await request('/staff/manage/'+path,'POST',body)
    if(token!==getToken())return
    if(result?.needsConfirmation){
     if(!await ask('同一笔转账',String(result.message||''),'确认登记'))return
     if(token!==getToken()){this.$emit('access-change');return}
     body={...body,confirmSharedReference:true};editor.sentBody=JSON.parse(JSON.stringify(body))
     result=await request('/staff/manage/'+path,'POST',body)
     if(token!==getToken())return
     if(result?.needsConfirmation){this.formError='没有登记成功，请刷新后重试';return}
    }
    this.setPending(editor.kind,null)
    this.editor=null;this.uncertain=false;this.view='detail';this.listStale=true
    if(result?.detail&&memberId===this.detailId)fresh=result.detail
    uni.showToast({title:result?.repeated?({topup:'这笔已登记过，没有重复到账',refund:'这笔已登记过，没有重复退款',void:'这笔已作废过'})[editor.kind]:CUSTOMER_DONE[editor.kind],icon:'none'})
   }catch(e){
    if(e.staleSession)return
    this.formError=e.message||'提交没有成功，请重试'
    this.uncertain=!!e.uncertain
    if(this.uncertain&&resend)this.setPending(editor.kind,{memberId,editor})
    if(ACCESS.test(this.formError)||!getToken())this.$emit('access-change')
   }finally{
    this.busy=false;this.$emit('busy',false)
    // 提交成功时服务器顺带给了最新的档案，直接用；没给（或换了人）再读一次
    if(!this.editor&&this.view==='detail'){if(fresh){this.detailSeq++;this.detailLoading=false;this.detail=fresh}else this.loadDetail()}
   }
  },
  closeEditor(){if(this.busy)return;this.editor=null;this.formError='';this.uncertain=false;this.view='detail'},
  closeAndCheck(){if(this.busy)return;this.closeEditor();this.loadDetail()},
  async dropPending(){
   if(this.busy||!this.editor)return
   const kind=this.editor.kind,body=this.pendingOf(kind)?.editor?.sentBody,what=kind==='refund'?'退款':'充值'
   if(!body){this.setPending(kind,null);this.closeEditor();return}
   if(!await ask('放弃这次'+what,'放弃前请先在'+what+'记录里确认没有这笔 '+money(body.amount)+' 的登记，否则再'+what+'会重复'+(kind==='refund'?'退款':'到账')+'。确认放弃？','确认放弃'))return
   this.setPending(kind,null);this.editor=null;this.uncertain=false;this.formError='';this.view='detail';this.loadDetail()
  },
  call(phone){uni.makePhoneCall({phoneNumber:String(phone),fail:e=>{if(!/cancel/i.test(e?.errMsg||''))uni.showToast({title:'请用手机拨打 '+phone,icon:'none',duration:3000})}})}
 }
}
</script>
<style scoped>
@import '../../../styles/component-base.css';@import '../styles/staff-module.css';
.row-head{margin-top:0;align-items:flex-start}
.tags.left{justify-content:flex-start;max-width:none;margin-top:6px}
.sorts{align-items:center}
.sort-label{font-size:13px;color:var(--shop-muted,#59727f);margin-right:2px}
.strong-line{font-weight:600}
.phone{text-decoration:underline}
.money-hidden{margin-top:10px}
.topup-button{margin-top:14px}
.refund-button{margin-top:10px}
.action{margin-top:10px}
.drop{display:block;width:100%;text-align:center;margin-top:10px}
.all-shown{text-align:center;margin-top:12px}
</style>
