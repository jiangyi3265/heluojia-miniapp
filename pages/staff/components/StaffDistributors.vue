<template>
 <view class="module-panel distributors">
  <template v-if="view==='list'">
   <view class="panel-heading"><view><text class="panel-title">{{info.title}}</text><text class="hint">{{info.hint}}</text></view><button class="small-button" :disabled="loading||busy" @click="refresh">刷新</button></view>
   <view class="search-row"><input v-model="q" confirm-type="search" maxlength="40" placeholder="姓名、昵称、手机号或 #会员编号" aria-label="搜索分销商" @confirm="search"/><button class="small-button" :disabled="loading" @click="search">查询</button></view>
   <view class="choices filters"><button v-for="f in filters" :key="f.key" :class="{chosen:filter===f.key}" :aria-pressed="filter===f.key" @click="setFilter(f.key)">{{f.label}}</button></view>
   <text v-if="loaded" class="hint">{{searched?'找到 '+total+' 位':'共 '+total+' 位'}}</text>
   <text v-if="error" class="error" role="alert">{{error}}</text>
   <view v-if="loading&&!loaded" class="empty">正在读取…</view>
   <view v-else-if="!loaded" class="empty">数据尚未读取成功，请点击上方刷新重试。</view>
   <view v-else-if="!rows.length" class="empty">{{searched?'没有找到匹配的分销商，换个关键词试试':filter!=='all'?'这个筛选下暂时没有分销商':'还没有分销商'}}</view>
   <view v-for="x in listRows" :key="x.row.memberId" class="record distributor-row" role="button" @click="openDetail(x.row)">
    <view class="line row-head"><text class="record-title">{{displayName(x.row)}}</text><view class="tags"><text class="tag" :class="{warn:!x.s.discount}">{{x.s.discount?'可拿货 '+x.s.discount:'暂不能拿货'}}</text><text v-if="x.row.self" class="tag">本人</text></view></view>
    <text class="hint">会员编号 {{x.row.memberId}} · {{phoneText(x.row)}}</text>
    <text class="hint">拿货来源：{{x.s.source}}</text>
    <text class="hint">累计有效加盟款 {{money(x.row.feeTotal)}}</text>
    <text class="hint">{{commissionText(x.row.retailCommission)}}</text>
    <text class="hint">本月推广业绩 {{money(x.row.monthPerformance&&x.row.monthPerformance.net)}}（{{(x.row.monthPerformance&&x.row.monthPerformance.orders)||0}} 单）</text>
   </view>
   <button v-if="loaded&&rows.length<total" class="secondary" :loading="loading" :disabled="loading" @click="loadList(true)">加载更多（已显示 {{rows.length}} / 共 {{total}} 位）</button>
   <text v-else-if="rows.length" class="hint all-shown">已显示全部 {{total}} 位</text>
  </template>

  <template v-else-if="view==='detail'">
   <button class="text-button" :disabled="busy" @click="backToList">‹ 返回列表</button>
   <text v-if="detailError" class="error" role="alert">{{detailError}}</text>
   <button v-if="detailError" class="secondary" :disabled="detailLoading" @click="loadDetail">重新读取</button>
   <view v-if="detailLoading&&!detail" class="empty">正在读取…</view>
   <template v-if="detail&&detail.member">
    <view class="accent-block">
     <text class="record-title">{{displayName(detail.member)}}</text>
     <text class="block-line">会员编号 {{detail.member.memberId}} · {{phoneText(detail.member)}}</text>
     <text v-if="nicknameLine" class="block-line">微信昵称 {{nicknameLine}}</text>
     <view class="tags left"><text class="tag">{{applicationText(detail.member.applicationState)}}</text><text v-if="detail.member.accountEnabled===false" class="tag warn">账号已停用</text></view>
    </view>
    <text v-if="self" class="notice-block">这是你本人的分销商账号。为避免自己给自己调整，登记加盟款、作废、调拿货档位和单独比例请由其他店长在电脑后台处理。</text>

    <text class="section-label">拿货档位</text>
    <view class="record">
     <text class="strong">{{status&&status.discount?'当前拿货折扣 '+status.discount:'暂不能拿货'}}</text>
     <text class="hint">来源：{{status&&status.source}}</text>
     <text v-if="status&&status.next" class="hint">{{status.next}}</text>
     <text v-for="(l,i) in ladder" :key="i" class="hint">{{l}}</text>
     <text class="hint">档位门槛和折扣在电脑后台「分销商与拿货」修改。</text>
     <button v-if="canManage" class="small-button action" :disabled="busy" @click="openTier">调整拿货档位</button>
    </view>

    <text class="section-label">零售佣金</text>
    <view class="record">
     <text class="strong">{{commissionText(detail.commission&&detail.commission.current)}}</text>
     <text class="hint">{{single?'已设单独比例 '+percentText(single.rate):'没有单独比例'}}</text>
     <text class="hint">单独比例优先于按拿货档位自动计算的比例和卖出奖励规则，只对之后的新订单生效。</text>
     <view v-if="canManage&&(canSetCommission||single)" class="actions"><button v-if="canSetCommission" class="small-button" :disabled="busy" @click="openCommission('set')">设置单独比例</button><button v-if="single" class="small-button" :disabled="busy" @click="openCommission('remove')">取消单独比例</button></view>
     <text v-if="canManage&&!canSetCommission" class="hint">推广资格审核通过、账号启用后才能设置单独比例。</text>
    </view>

    <text class="section-label">加盟款</text>
    <view class="record">
     <text class="strong">累计有效加盟款 {{money(totals.validAmount)}}（{{totals.validCount||0}} 笔）</text>
     <button v-if="canRegister" class="small-button action" :disabled="busy" @click="openFee">登记加盟款</button>
     <text v-else-if="me.canRegisterPartnerFees===true&&writable" class="hint">推广资格未通过或已停用，不能登记加盟款。</text>
     <text v-if="pendingHere" class="notice-block">有一笔登记结果还没确认，点「登记加盟款」核对后再处理。</text>
    </view>
    <view v-for="f in feeRecords" :key="f.id" class="record fee-record">
     <view class="line"><text class="strong">{{money(f.amount)}} · {{f.methodLabel||feeMethodName(f.method)}}</text><text class="tag" :class="{off:f.state!=='valid'}">{{f.state==='valid'?'有效':'已作废'}}</text></view>
     <text class="hint">收款时间 {{timeText(f.paidAt)}}</text>
     <text v-if="f.referenceNo" class="hint" selectable>凭证号 {{f.referenceNo}}</text>
     <text v-if="f.note" class="hint">备注：{{f.note}}</text>
     <text class="hint">登记：{{f.createdBy}} · {{timeText(f.createdAt)}}</text>
     <text v-if="f.state!=='valid'" class="hint warn-note">作废：{{f.voidedBy}} · {{timeText(f.voidedAt)}} · 原因：{{f.voidReason}}</text>
     <CaseProofs v-if="f.hasProof" :case-id="f.id" :count="1" :proof-path="'/staff/manage/distributors/fees/'+f.id+'/proof'"/>
     <button v-if="canManage&&f.state==='valid'" class="small-button action" :disabled="busy" @click="openVoid(f)">作废</button>
    </view>
    <view v-if="!feeRecords.length" class="empty">还没有登记过加盟款</view>
    <text v-if="detail.fees&&detail.fees.truncated" class="hint">这里只显示最近 50 条，更早的记录请在电脑后台查看。</text>

    <text class="section-label">推广业绩</text>
    <view class="record">
     <text class="hint">按推广带来的已付订单金额，已扣除退款；有上一层推广人的订单算到上一层。</text>
     <view class="line"><text>本月</text><text class="strong">{{money(thisMonth.net)}}（{{thisMonth.orders||0}} 单）</text></view>
     <view class="line"><text>上月</text><text class="strong">{{money(lastMonth.net)}}（{{lastMonth.orders||0}} 单）</text></view>
    </view>
   </template>
  </template>

  <template v-else-if="view==='editor'&&editor&&detail">
   <view class="editor">
    <button class="text-button" :disabled="busy" @click="closeEditor">‹ 返回详情</button>
    <text class="editor-title">{{editor.title}}</text>
    <text class="hint">{{memberLabel(detail.member)}}</text>

    <template v-if="editor.kind==='fee'">
     <text class="label">金额（元）</text><input type="digit" v-model="editor.amount" :disabled="locked" placeholder="例如 19800"/>
     <text class="label">收款方式</text>
     <view class="choices"><button v-for="m in feeMethods" :key="m[0]" :class="{chosen:editor.method===m[0]}" :disabled="locked" @click="editor.method=m[0]">{{m[1]}}</button></view>
     <text class="label">收款时间</text>
     <view class="pair"><view><picker mode="date" :value="editor.date" start="2020-01-01" :end="today" :disabled="locked" @change="editor.date=$event.detail.value"><view class="picker">{{editor.date}}</view></picker></view><view><picker mode="time" :value="editor.time" :disabled="locked" @change="editor.time=$event.detail.value"><view class="picker">{{editor.time}}</view></picker></view></view>
     <text class="label">凭证号（选填）</text><input v-model="editor.referenceNo" :disabled="locked" maxlength="80" placeholder="银行流水号、转账单号等"/>
     <text class="label">备注（选填）</text><textarea v-model="editor.note" :disabled="locked" maxlength="300" auto-height placeholder="例如 首笔加盟款"/>
     <text class="label">凭证图片（选填）</text>
     <view v-if="editor.proofLocal" class="proof-line"><image class="proof-preview" :src="editor.proofLocal" mode="aspectFill"/><button class="small-button" :disabled="locked" @click="chooseProof">换一张</button><button class="small-button" :disabled="locked" @click="removeProof">删除</button></view>
     <button v-else class="small-button" :disabled="locked" @click="chooseProof">{{uploading?'正在上传…':'选择图片'}}</button>
     <view class="accent-block">{{feePreview(detail.profile,feeFen)}}</view>
     <text v-if="duplicate" class="notice-block">{{duplicate}}</text>
     <text class="hint">加盟款只用来确定拿货档位，不会变成余额，也不产生佣金。</text>
    </template>

    <template v-if="editor.kind==='void'">
     <view class="money-lines"><view><text>金额</text><text>{{money(editor.fee.amount)}}</text></view><view><text>收款方式</text><text>{{editor.fee.methodLabel||feeMethodName(editor.fee.method)}}</text></view><view><text>收款时间</text><text>{{timeText(editor.fee.paidAt)}}</text></view><view v-if="editor.fee.referenceNo"><text>凭证号</text><text>{{editor.fee.referenceNo}}</text></view></view>
     <text class="label">作废原因</text><textarea v-model="editor.reason" :disabled="locked" maxlength="300" placeholder="例如 重复登记、金额填错"/>
     <text class="notice-block">作废后不能恢复。累计加盟款会减少，拿货档位可能下降；下降或不能拿货时，这位分销商未付款的拿货单会被自动取消。</text>
    </template>

    <template v-if="editor.kind==='tier'">
     <text class="hint">现在：{{currentTierText(detail.profile)}}</text>
     <text class="label">拿货方式</text>
     <view class="choices"><button v-for="m in tierModes" :key="m[0]" :class="{chosen:editor.mode===m[0]}" :disabled="locked||(m[0]!=='blocked'&&!approved)" @click="editor.mode=m[0]">{{m[1]}}</button></view>
     <text v-if="!approved" class="hint">推广资格审核通过后才能选择按加盟款自动定档或手动指定。</text>
     <template v-if="editor.mode==='fixed'">
      <text class="label">指定档位</text>
      <view class="choices"><button v-for="t in tierButtons" :key="t.tier" :class="{chosen:Number(editor.tier)===t.tier}" :disabled="locked" @click="editor.tier=t.tier">{{t.label}}</button></view>
     </template>
     <view class="accent-block">保存后：{{tierChoiceText(detail.profile,editor.mode,Number(editor.tier))}}</view>
     <text v-if="isDowngrade(detail.profile,editor.mode,Number(editor.tier))" class="notice-block">档位下降或停用后，这位分销商未付款的拿货单会被自动取消。</text>
    </template>

    <template v-if="editor.kind==='commission'&&editor.action==='set'">
     <text class="hint">现在：{{commissionText(detail.commission&&detail.commission.current)}}</text>
     <text class="label">单独比例（%）</text><input type="digit" v-model="editor.percent" :disabled="locked" placeholder="0 到 90，例如 70"/>
     <text class="label">原因</text><textarea v-model="editor.reason" :disabled="locked" maxlength="300" placeholder="例如 合作约定"/>
     <text class="hint">单独比例优先于按拿货档位自动计算的比例和卖出奖励规则，只对之后的新订单生效。</text>
    </template>
    <template v-if="editor.kind==='commission'&&editor.action==='remove'">
     <text class="hint">现在：已设单独比例 {{single?percentText(single.rate):''}}</text>
     <view class="accent-block">取消后：零售佣金{{afterRemoveText(detail.commission&&detail.commission.afterRemove)}}</view>
     <text class="label">原因</text><textarea v-model="editor.reason" :disabled="locked" maxlength="300" placeholder="例如 合作结束"/>
    </template>

    <text v-if="formError" class="error" role="alert">{{formError}}</text>
    <text v-if="uncertain" class="notice">{{uncertainText}}</text>
    <button v-if="editor.kind==='fee'" class="primary" :loading="busy" :disabled="busy" @click="submit">{{uncertain?'原样重新提交':'确认登记'}}</button>
    <button v-else class="primary" :loading="busy" :disabled="busy||uncertain" @click="submit">{{uncertain?'请先核对最新状态':primaryText}}</button>
    <button v-if="uncertain" class="secondary" :disabled="busy" @click="closeAndCheck">返回详情核对</button>
    <button v-if="editor.kind==='fee'&&(uncertain||pendingFee&&pendingFee.editor===editor)" class="text-button drop" :disabled="busy" @click="dropPendingFee">放弃这次内容</button>
   </view>
  </template>
 </view>
</template>
<script>
import CaseProofs from '../../../components/CaseProofs.vue'
import {request,getToken,API_BASE} from '../../../services/shop'
import {uploadImage} from '../../../services/image-upload'
import {MANAGEMENT_MODULES,beijingToday,beijingClock} from '../services/staff-management'
import {DISTRIBUTOR_FILTERS,FEE_METHODS,TIER_MODES,PROOF_PATH,money,bigYuanToFen,discountText,percentText,listQuery,searchProblem,displayName,phoneText,memberLabel,applicationText,rowProfile,tierStatus,tierLadder,commissionText,afterRemoveText,feeMethodName,timeText,newFeeRequestKey,readFeeForm,feePreview,recentDuplicate,readVoidForm,readTierChoice,currentTierText,tierChoiceText,isDowngrade,readCommissionForm,rateToPercentInput,feeConfirmText,feeRetryConfirmText,voidConfirmText,tierConfirmText,commissionConfirmText,DISTRIBUTOR_UNCERTAIN,DISTRIBUTOR_DONE} from '../services/staff-distributors'
const ACCESS=/绑定|权限|无权|登录/
const ask=(title,content,confirmText)=>new Promise(resolve=>uni.showModal({title,content,confirmText,cancelText:'再看看',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))
export default {
 components:{CaseProofs},
 props:{module:{required:true},me:{required:true}},
 emits:['access-change','busy'],
 data(){return{view:'list',q:'',searched:'',filter:'all',rows:[],total:0,page:0,loaded:false,loading:false,error:'',sequence:0,selection:0,listStale:false,
  detailId:0,detail:null,detailLoading:false,detailError:'',detailSeq:0,
  editor:null,formError:'',uncertain:false,busy:false,uploading:false,pendingFee:null,today:beijingToday()}},
 computed:{
  info(){return MANAGEMENT_MODULES.find(m=>m.key===this.module)||{}},
  filters(){return DISTRIBUTOR_FILTERS},
  feeMethods(){return FEE_METHODS},
  tierModes(){return TIER_MODES},
  listRows(){return this.rows.map(row=>({row,s:tierStatus(rowProfile(row),row.retailCommission)}))},
  self(){return this.detail?.actions?.self===true},
  writable(){return !!this.detail&&!this.self},
  canRegister(){return this.me.canRegisterPartnerFees===true&&this.detail?.actions?.canRegisterFee===true},
  canManage(){return this.me.canManageDistributors===true&&this.detail?.actions?.canManage===true},
  // 还没更新的后端不返回 canSetCommission：按原来的规则显示（小程序与后端先后上线期间兼容）
  canSetCommission(){const v=this.detail?.actions?.canSetCommission;return this.canManage&&(v===true||v===undefined)},
  status(){return this.detail?tierStatus({...this.detail.profile,accountEnabled:this.detail.member?.accountEnabled},this.detail.commission?.current):null},
  ladder(){return tierLadder(this.detail?.profile)},
  single(){return this.detail?.commission?.single||null},
  approved(){return this.detail?.profile?.applicationState==='approved'},
  totals(){return this.detail?.fees?.totals||{}},
  feeRecords(){return Array.isArray(this.detail?.fees?.records)?this.detail.fees.records:[]},
  thisMonth(){return this.detail?.performance?.thisMonth||{}},
  lastMonth(){return this.detail?.performance?.lastMonth||{}},
  nicknameLine(){const m=this.detail?.member,n=String(m?.nickname||'').trim();return n&&n!==displayName(m)?n:''},
  tierButtons(){const p=this.detail?.profile||{};return [1,2,3].map(tier=>({tier,label:['第一档','第二档','第三档'][tier-1]+(p.tiers?.[tier-1]?.name?' '+p.tiers[tier-1].name:'')+' '+discountText(p.tiers?.[tier-1]?.rate??p.discountRates?.[tier-1])}))},
  locked(){return this.busy||this.uncertain},
  feeFen(){try{return this.editor?.kind==='fee'?bigYuanToFen(this.editor.amount):0}catch{return 0}},
  duplicate(){return this.editor?.kind==='fee'&&!this.uncertain?recentDuplicate(this.detail?.fees?.records,this.feeFen,Date.now()):''},
  pendingHere(){return this.pendingFee?.memberId===this.detailId},
  uncertainText(){return DISTRIBUTOR_UNCERTAIN[this.editor?.kind]||''},
  primaryText(){const e=this.editor;return !e?'':e.kind==='void'?'确认作废':e.kind==='tier'?'确认调整':e.action==='remove'?'确认取消':'确认设置'}
 },
 mounted(){this.loadList(false)},
 beforeUnmount(){this.sequence++;this.detailSeq++},
 methods:{
  money,percentText,displayName,phoneText,memberLabel,applicationText,commissionText,afterRemoveText,feeMethodName,timeText,feePreview,currentTierText,tierChoiceText,isDowngrade,
  refresh(){if(this.busy||this.view==='editor')return;if(this.view==='detail')return this.loadDetail();return this.loadList(false)},
  // 登录已被清掉（例如“账号已停用”，shop.js 已清本地登录）时，文案里不一定有关键词，也要让父页面回到登录。
  fail(e){if(e.staleSession)return;this.error=e.message||'暂时读取不到，请重试';if(ACCESS.test(this.error)||!getToken())this.$emit('access-change')},
  search(){const q=this.q.trim(),p=searchProblem(q);if(p){this.error=p;return}this.searched=q;this.selection++;this.loadList(false)},
  setFilter(key){if(key===this.filter)return;this.filter=key;this.selection++;this.loadList(false)},
  // A page is kept only when it arrives for the current search and filter; a failed page leaves the list as it was.
  async loadList(more){
   if(more&&(this.loading||this.rows.length>=this.total))return
   const sel=this.selection,seq=++this.sequence,next=more?this.page+1:1
   this.loading=true;this.error=''
   try{const r=await request('/staff/manage/distributors?'+listQuery({q:this.searched,filter:this.filter,page:next}))
    if(seq!==this.sequence||sel!==this.selection)return
    const got=Array.isArray(r?.rows)?r.rows:[]
    this.rows=more?[...this.rows,...got.filter(x=>!this.rows.some(o=>o.memberId===x.memberId))]:got
    this.total=Number(r?.total)||0;this.page=next;this.loaded=true;this.listStale=false}
   catch(e){if(seq===this.sequence&&sel===this.selection)this.fail(e)}
   finally{if(seq===this.sequence)this.loading=false}
  },
  loadMore(){if(this.view==='list'&&this.loaded&&!this.loading&&!this.error&&this.rows.length<this.total)this.loadList(true)},
  openDetail(r){this.detailId=r.memberId;this.detail=null;this.view='detail';this.loadDetail();uni.pageScrollTo({scrollTop:0,duration:0})},
  async loadDetail(){
   const seq=++this.detailSeq,id=this.detailId;this.detailLoading=true;this.detailError=''
   try{const r=await request('/staff/manage/distributors/'+id);if(seq!==this.detailSeq)return;this.detail=r}
   catch(e){if(seq!==this.detailSeq||e.staleSession)return;this.detailError=e.message||'暂时读取不到，请重试';if(ACCESS.test(this.detailError)||!getToken())this.$emit('access-change')}
   finally{if(seq===this.detailSeq)this.detailLoading=false}
  },
  backToList(){if(this.busy)return;this.view='list';this.detail=null;this.detailSeq++;this.detailLoading=false;if(this.listStale)this.loadList(false)},
  begin(){this.view='editor';this.formError='';this.uncertain=false;uni.pageScrollTo({scrollTop:0,duration:0})},
  openFee(){
   if(this.busy||!this.detail)return
   if(this.pendingHere){this.editor=this.pendingFee.editor;this.view='editor';this.formError='';this.uncertain=true;uni.pageScrollTo({scrollTop:0,duration:0});return}
   this.editor={kind:'fee',title:'登记加盟款',amount:'',method:'bank',date:beijingToday(),time:beijingClock(),referenceNo:'',note:'',proofUrl:'',proofLocal:'',requestKey:newFeeRequestKey(),sentBody:null}
   this.today=beijingToday();this.begin()
  },
  openVoid(f){if(this.busy)return;this.editor={kind:'void',title:'作废加盟款',fee:f,reason:''};this.begin()},
  openTier(){if(this.busy||!this.detail)return;const p=this.detail.profile||{};this.editor={kind:'tier',title:'调整拿货档位',mode:p.mode||'auto',tier:p.mode==='fixed'?Number(p.tier)||0:0};this.begin()},
  openCommission(action){if(this.busy)return;this.editor={kind:'commission',action,title:action==='set'?'设置单独佣金比例':'取消单独佣金比例',percent:this.single?rateToPercentInput(this.single.rate):'',reason:''};this.begin()},
  chooseProof(){
   if(this.busy||this.uncertain)return
   uni.chooseImage({count:1,sizeType:['compressed'],sourceType:['album','camera'],success:async r=>{
    const path=r.tempFilePaths?.[0];if(!path)return
    const token=getToken(),editor=this.editor;this.busy=true;this.uploading=true;this.$emit('busy',true);this.formError=''
    try{const uri=await uploadImage({path,url:API_BASE+'/shop/app/staff/manage/distributors/'+this.detailId+'/fee-proof',token})
     if(token!==getToken()||editor!==this.editor)return
     if(!PROOF_PATH.test(uri||''))throw Error('凭证图片无效，请重新上传')
     editor.proofUrl=uri;editor.proofLocal=path}
    catch(e){
     // 换成另一个账号：不把旧账号的上传错误给新账号看。登录被清掉，或上传接口说账号已停用（上传不会清本地登录）：让父页面重新核对身份。
     if(e.staleSession||(getToken()&&token!==getToken())||editor!==this.editor)return
     this.formError=e.message||'图片上传失败，请重试';if(ACCESS.test(this.formError)||/账号已停用/.test(this.formError)||!getToken())this.$emit('access-change')}
    finally{this.busy=false;this.uploading=false;this.$emit('busy',false)}
   },fail:e=>{if(!/cancel/i.test(e?.errMsg||''))this.formError='没有打开相册，请重试'}})
  },
  removeProof(){if(this.busy||this.uncertain||!this.editor)return;this.editor.proofUrl='';this.editor.proofLocal=''},
  read(){const e=this.editor;return e.kind==='fee'?readFeeForm(e,Date.now()):e.kind==='void'?readVoidForm(e):e.kind==='tier'?readTierChoice(this.detail.profile,e):readCommissionForm(e)},
  path(){const e=this.editor;return e.kind==='fee'?'distributors/'+this.detailId+'/fees':e.kind==='void'?'distributors/fees/'+e.fee.id+'/void':e.kind==='tier'?'distributors/'+this.detailId+'/tier':'distributors/'+this.detailId+'/commission'},
  // A fee whose answer was lost is resent byte for byte (same request key); every other uncertain write is re-read first.
  async submit(){
   if(this.busy||!this.editor)return
   const editor=this.editor,retry=this.uncertain&&editor.kind==='fee'
   if(this.uncertain&&!retry)return
   let body
   if(retry)body=editor.sentBody
   else{const r=this.read();if(r.error){this.formError=r.error;return}body=r.body}
   if(!body)return
   const token=getToken(),member=this.detail.member,path=this.path()
   const T={fee:['登记加盟款','确认登记'],void:['作废加盟款','确认作废'],tier:['调整拿货档位','确认调整'],commission:[editor.action==='remove'?'取消单独比例':'设置单独比例',editor.action==='remove'?'确认取消':'确认设置']}[editor.kind]
   const text=retry?feeRetryConfirmText(body):editor.kind==='fee'?feeConfirmText(member,body):editor.kind==='void'?voidConfirmText(member,editor.fee,this.detail.profile):editor.kind==='tier'?tierConfirmText(member,this.detail.profile,body):commissionConfirmText(member,body,this.detail)
   this.busy=true;this.$emit('busy',true);this.formError=''
   try{
    if(!await ask(T[0],text,retry?'确认提交':T[1]))return
    // 确认框打开期间退出或换了账号：不提交，由父页面按现在的登录重新加载
    if(token!==getToken()){this.$emit('access-change');return}
    if(editor.kind==='fee'&&!retry)editor.sentBody=JSON.parse(JSON.stringify(body))
    let result=await request('/staff/manage/'+path,'POST',body)
    if(token!==getToken())return
    if(editor.kind==='fee'&&result?.needsConfirmation){
     // 店主 10-05：同一个银行流水号已登记成门店充值或对公收款，店长看过说明、确认后再提交；这次什么都没登记
     if(!await ask('同一笔转账',String(result.message||''),'确认登记'))return
     if(token!==getToken()){this.$emit('access-change');return}
     body={...body,confirmSharedReference:true};editor.sentBody=JSON.parse(JSON.stringify(body))
     result=await request('/staff/manage/'+path,'POST',body)
     if(token!==getToken())return
     if(result?.needsConfirmation){this.formError='没有登记成功，请刷新后重试';return}
    }
    if(editor.kind==='fee')this.pendingFee=null
    this.editor=null;this.uncertain=false;this.view='detail';this.listStale=true
    uni.showToast({title:editor.kind==='fee'&&result?.repeated?'这笔已登记过，没有重复计入':result?.changed===false?'和现在的设置一样，没有改动':DISTRIBUTOR_DONE[editor.kind],icon:'none'})
   }catch(e){
    if(e.staleSession)return
    this.formError=e.message||'提交没有成功，请重试'
    this.uncertain=!!e.uncertain
    if(this.uncertain&&editor.kind==='fee')this.pendingFee={memberId:this.detailId,editor}
    if(ACCESS.test(this.formError)||!getToken())this.$emit('access-change')
   }finally{
    this.busy=false;this.$emit('busy',false)
    if(!this.editor&&this.view==='detail')this.loadDetail()
   }
  },
  closeEditor(){if(this.busy)return;this.editor=null;this.formError='';this.uncertain=false;this.view='detail'},
  closeAndCheck(){if(this.busy)return;this.closeEditor();this.loadDetail()},
  async dropPendingFee(){
   if(this.busy)return
   const body=this.pendingFee?.editor?.sentBody
   if(!body){this.pendingFee=null;this.closeEditor();return}
   if(!await ask('放弃这次登记','放弃前请先在加盟款记录里确认没有这笔 '+money(body.amount)+' 的登记，否则再登记会重复。确认放弃？','确认放弃'))return
   this.pendingFee=null;this.editor=null;this.uncertain=false;this.formError='';this.view='detail';this.loadDetail()
  }
 }
}
</script>
<style scoped>
@import '../../../styles/component-base.css';@import '../styles/staff-module.css';
.row-head{margin-top:0;align-items:flex-start}
.tags.left{justify-content:flex-start;max-width:none;margin-top:6px}
.action{margin-top:10px}
.proof-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.drop{display:block;width:100%;text-align:center;margin-top:10px}
.all-shown{text-align:center;margin-top:12px}
</style>
