<template>
 <view class="management-panel">
  <view class="panel-heading"><view><text class="panel-title">{{moduleInfo.title}}</text><text class="hint">{{moduleHint(moduleInfo,me)}}</text></view><button class="small-button" :disabled="loading||busy" @click="refresh">刷新</button></view>
  <view v-if="error" class="error" role="alert">{{error}}</view>
  <view v-if="loading&&!loaded" class="empty">正在读取…</view>
  <view v-else-if="!loaded" class="empty">数据尚未读取成功，请点击上方刷新重试。</view>
  <template v-else-if="editor">
   <view class="editor">
    <button class="text-button" :disabled="busy" @click="closeEditor">‹ 返回列表</button>
    <text class="editor-title">{{editor.title}}</text>
    <text class="hint">{{editor.subtitle}}</text>
    <template v-if="module==='products'">
     <text class="label">商品名称</text><input :disabled="busy||uncertain" v-model="editor.name" maxlength="120"/>
     <text class="label">规格</text><input :disabled="busy||uncertain" v-model="editor.spec" maxlength="60"/>
     <text class="label">零售价（元）</text><input :disabled="busy||uncertain" v-model="editor.price" type="digit"/>
     <text class="label">商品说明</text><textarea :disabled="busy||uncertain" v-model="editor.detail" maxlength="10000" auto-height/>
     <view class="line"><text>商品上架</text><switch :disabled="busy||uncertain" :checked="editor.enabled" color="#73afcb" @change="editor.enabled=$event.detail.value"/></view>
     <text class="hint">已有订单价格不变，新的零售、充值折扣和拿货报价按商品最新原价计算。</text>
    </template>
    <template v-if="module==='stocks'">
     <text class="label">仓库及渠道</text><text class="value">{{editor.row.warehouse_name}} · {{editor.row.channel==='B'?'采购':'零售'}}</text>
     <text class="label">调整数量（增加填正数，减少填负数）</text><input :disabled="busy||uncertain" v-model="editor.delta" type="text" placeholder="例如 10 或 -5"/>
     <text class="hint">当前可售 {{editor.row.available}} 件；占用中的库存不会被直接扣减。</text>
    </template>
    <template v-if="module==='members'">
     <view class="choices"><button v-for="choice in [['approved','通过申请'],['rejected','驳回申请']]" :key="choice[0]" :disabled="busy||uncertain" :class="{chosen:editor.state===choice[0]}" @click="editor.state=choice[0]">{{choice[1]}}</button></view>
     <text v-if="editor.kind==='distributor'" class="hint">通过后开通推广资格；拿货折扣仍按已登记加盟款或商家指定档位计算。</text><text v-if="editor.kind&&editor.row&&parseObject(editor.row[editor.kind+'_data']).previousNote" class="hint warn-note">这位申请人之前被关闭或驳回过，原因：{{parseObject(editor.row[editor.kind+'_data']).previousNote}}</text>
    </template>
    <template v-if="module==='cases'">
     <view class="choices"><button v-for="action in caseActions(editor.row)" :key="action[0]" :disabled="busy||uncertain" :class="{chosen:editor.action===action[0]}" @click="editor.action=action[0]">{{action[1]}}</button></view>
     <view v-if="editor.action==='approve'&&['return','exchange'].includes(editor.row.type)"><text class="label">寄回地址、联系人和电话</text><textarea :disabled="busy||uncertain" v-model="editor.returnAddress" maxlength="500" auto-height/></view>
     <view v-if="editor.action==='extend'"><text class="label">在原截止时间上再延长（天，已过期的从今天起算）</text><input :disabled="busy||uncertain" v-model="editor.days" type="number"/></view>
     <view v-if="['received','reship'].includes(editor.action)"><text class="label">处理仓库</text><picker :disabled="busy||uncertain" :range="warehouses" range-key="name" :value="editor.warehouseIndex" @change="editor.warehouseIndex=Number($event.detail.value)"><view class="picker">{{warehouses[editor.warehouseIndex]?.name||'请选择仓库'}} ›</view></picker></view>
     <view v-if="editor.action==='inspect'"><text class="hint">逐项填写实际验收合格数量，其余计入不合格待处理。确认验收后继续退款或换货。</text><view v-for="item in editor.inspection" :key="item.productId"><text class="label">{{item.name}}（寄回 {{item.quantity}} 件）</text><input :disabled="busy||uncertain" v-model="item.accepted" type="number" placeholder="实际合格件数"/></view></view>
     <view v-if="editor.action==='reship'"><text class="label">物流公司</text><input :disabled="busy||uncertain" v-model="editor.carrier" maxlength="80"/><text class="label">换补发运单号</text><input :disabled="busy||uncertain" v-model="editor.tracking" maxlength="100"/></view>
     <text v-if="editor.action==='close'" class="hint">关闭后这张售后单记为未通过，订单照常结算积分和佣金；顾客如仍需退换可重新申请。</text><text v-if="editor.action==='retry_refund'" class="hint">微信已关闭这笔退款，没有退出任何钱。确认后用新的退款单号重新向微信发起原路退款。</text>
     <text v-if="editor.action==='received'" class="hint">确认收到后进入待验收，完成验收前不会增加可售库存。</text>
     <text v-if="editor.row.type==='refund'&&editor.action==='approve'" class="notice">确认通过将处理 {{yuan(editor.row.amount)}} 退款，请核对后提交。</text>
    </template>
    <template v-if="module==='withdrawals'">
     <view class="money-lines"><view><text>申请金额</text><text>{{yuan(editor.row.amount)}}</text></view><view><text>代扣税费</text><text>{{yuan(editor.row.tax_amount)}}</text></view><view><text>平台服务费</text><text>{{yuan(editor.row.service_fee)}}</text></view><view><text>手续费</text><text>{{yuan(editor.row.fee)}}</text></view><view v-if="editor.state==='close'" class="strong"><text>关闭后退回可提现佣金</text><text>{{yuan(editor.row.amount)}}</text></view><view v-else class="strong"><text>预计到账</text><text>{{yuan(netWithdrawal(editor.row))}}</text></view></view>
     <text v-if="editor.state==='approve'" class="hint">审核通过后由系统向客户微信零钱发起转账，最终到账以微信返回结果为准。</text><text v-else-if="editor.state==='close'" class="hint">系统会先向微信再查一次：微信确认没有这笔转账，才会关闭并把 {{yuan(editor.row.amount)}} 退回推广员的可提现佣金；微信查到了就不会关闭。</text><text v-else class="hint">拒绝或取消后不会发起转账，这笔金额退回推广员的可提现佣金。</text>
    </template>
    <template v-if="module!=='products'"><text class="label">{{module==='stocks'?'调整依据':editor.state==='close'?'关闭原因':'处理说明'}}</text><textarea :disabled="busy||uncertain" v-model="editor.note" :maxlength="module==='stocks'?300:500" auto-height :placeholder="editor.state==='close'?'例如：已在微信支付商户平台核实没有这笔转账':'填写原因，便于之后核对'"/></template>
    <text v-if="formError" class="error" role="alert">{{formError}}</text>
    <text v-if="uncertain" class="notice">{{module==='stocks'?'上次请求结果未确认，本次内容已锁定。重试会使用原来的内容和单号，避免重复计入。':'上次请求结果未确认，本次内容已锁定。请返回核对最新状态，再决定是否需要操作。'}}</text>
    <button class="primary" role="button" :aria-disabled="busy||uncertain&&module!=='stocks'" :loading="busy" :disabled="busy||uncertain&&module!=='stocks'" @click="submit">{{uncertain?(module==='stocks'?'重试同一笔库存调整':'请先核对最新状态'):'确认保存'}}</button>
    <button v-if="uncertain" class="secondary" :disabled="busy" @click="closeAndRefresh">返回并核对最新状态</button>
   </view>
  </template>
  <template v-else-if="module==='cash'">
   <view class="date-row"><picker mode="date" :value="from" @change="from=$event.detail.value"><view class="picker">{{from}}</view></picker><text>至</text><picker mode="date" :value="to" @change="to=$event.detail.value"><view class="picker">{{to}}</view></picker><button class="small-button" :disabled="loading" @click="refresh">查询</button></view>
   <text class="hint">当前显示 {{cashData.period?.from}} 至 {{cashData.period?.to}}，按北京时间到账确认时间统计。修改日期后请点击查询，余额消费不会再次算作收款。</text>
   <view class="cash-totals"><view><text>实际收款</text><text>{{yuan(cashTotals.received)}}</text></view><view><text>退款</text><text>{{yuan(cashTotals.refunded)}}</text></view><view><text>收款净额</text><text>{{yuan(cashTotals.net)}}</text></view></view>
   <view v-for="r in cashData.bySource||[]" :key="r.source" class="record"><text class="record-title">{{sourceLabel(r.source)}}</text><view class="line"><text>收款 {{yuan(r.received)}}</text><text>退款 {{yuan(r.refunded)}}</text></view></view>
   <text class="section-label">收退明细</text>
   <view v-for="(r,i) in cashData.details||[]" :key="i" class="record"><view class="line"><text>{{r.label}}</text><text class="strong">{{r.direction==='out'?'−':'+'}}{{yuan(r.amount)}}</text></view><text class="hint">{{formatDate(r.time)}} · {{r.memberNickname}}</text><text class="hint" selectable>{{r.reference}}</text></view>
   <view class="pager"><button :disabled="loading||cashPage===1" @click="loadCash(cashPage-1,true)">上一页</button><text>{{cashPage}} / {{Math.max(1,Math.ceil((cashData.detailTotal||0)/20))}}</text><button :disabled="loading||cashPage*20>=(cashData.detailTotal||0)" @click="loadCash(cashPage+1,true)">下一页</button></view>
   <text class="hint">收款净额不是利润，佣金、手续费、税费和商品成本另外核算。</text>
  </template>
  <template v-else>
   <input class="search" v-model="keyword" :placeholder="moduleInfo.search||'搜索名称或编号'" aria-label="搜索管理记录"/>
   <view v-if="module==='stocks'" class="choices"><button :class="{chosen:!stockHistory}" @click="stockHistory=false">分仓库存</button><button :class="{chosen:stockHistory}" @click="stockHistory=true">库存流水</button></view><text v-if="module==='stocks'&&stockHistory&&movementsTruncated" class="hint block">这里只显示最近 300 条流水，更早的记录请在电脑后台“仓库与渠道库存 → 库存流水”里查看。</text>
   <view v-if="['members','cases','withdrawals'].includes(module)" class="choices"><button :class="{chosen:pendingOnly}" @click="setPending(true)">待处理</button><button :class="{chosen:!pendingOnly}" @click="setPending(false)">全部记录</button></view>
   <view v-if="!filtered.length" class="empty">{{keyword?'没有找到匹配记录':'暂时没有相关记录'}}</view>
   <view v-for="(r,index) in visibleRows" :key="r.id||index" class="record">
    <template v-if="module==='products'">
     <view class="product-row"><image :src="asset(r.image,160)" mode="aspectFit"/><view><text class="record-title">{{r.name}}</text><text class="hint">{{[r.spec,r.product_code].filter(Boolean).join(' · ')}}</text><text class="strong">{{yuan(r.price)}}</text></view><text class="tag">{{enabled(r.enabled)?'已上架':'已下架'}}</text></view>
     <view class="line"><text class="hint">总库存 {{r.stock}} 件</text><button v-if="me.canEditProducts" class="small-button" :disabled="busy" @click="editProduct(r)">编辑商品</button></view>
    </template>
    <template v-if="module==='stocks'&&stockHistory"><text class="record-title">{{r.product_name}}</text><text class="hint">{{r.warehouse_name}} · {{r.channel==='B'?'采购':'零售'}} · {{formatDate(r.created_at)}}</text><text v-if="r.order_no" class="hint" selectable>订单 {{r.order_no}}</text><view class="line"><text>{{stockMovement(r).label}} {{stockMovement(r).quantity}} 件</text><text>{{stockOperator(r)}}</text></view><text class="hint">{{r.note}}</text></template>
    <template v-else-if="module==='stocks'">
     <text class="record-title">{{r.product_name}} {{r.spec}}</text><text class="hint">{{r.warehouse_name}} · {{r.channel==='B'?'采购':'零售'}}</text>
     <text v-if="!warehouseActive(r.warehouse_id)" class="notice">仓库已停用，只能查看现有库存。</text><view class="stock-values"><text>可售 {{r.available}}</text><text>订单占用 {{r.reserved}}</text><text>活动占用 {{r.campaign_reserved}}</text></view>
     <view class="line"><text class="hint">待验 {{r.quarantine}} · 不合格 {{r.damaged}}</text><button v-if="me.canAdjustStock&&warehouseActive(r.warehouse_id)" class="small-button" @click="editStock(r)">调整可售库存</button></view>
    </template>
    <template v-if="module==='members'">
     <text class="record-title">{{memberName(r,r.enterprise_state==='pending'&&r.distributor_state!=='pending'?'enterprise':'distributor')}}</text><text class="hint">会员编号 {{r.id}} · {{r.contact_phone||r.phone||parseObject(r.distributor_data).phone||parseObject(r.enterprise_data).phone||'未填写联系电话'}}</text>
     <view v-for="kind in ['distributor','enterprise']" :key="kind"><view class="line"><text>{{kind==='distributor'?'分销资格':'企业认证'}}：{{applicationState(r[kind+'_state'],kind)}}</text><button v-if="me.canReviewCustomers&&r[kind+'_state']==='pending'&&!r.self" class="small-button" @click="editMember(r,kind)">审核</button><text v-if="me.canReviewCustomers&&r[kind+'_state']==='pending'&&r.self" class="hint">本人的申请请由其他同事审核</text></view><text v-if="r[kind+'_state']==='rejected'&&r[kind+'_note']" class="hint">原因：{{r[kind+'_note']}}</text><text v-if="r[kind+'_state']==='pending'&&parseObject(r[kind+'_data']).previousNote" class="hint warn-note">上次未通过/停用原因：{{parseObject(r[kind+'_data']).previousNote}}</text><text v-if="parseObject(r[kind+'_data']).company" class="hint">{{parseObject(r[kind+'_data']).company}}</text><text v-if="parseObject(r[kind+'_data']).name" class="hint">联系人：{{parseObject(r[kind+'_data']).name}} {{parseObject(r[kind+'_data']).phone}}</text><CaseProofs v-if="parseObject(r[kind+'_data']).license" :case-id="r.id" :count="1" :heading="kind==='distributor'?'分销核验资料':'营业执照'" :proof-path="'/staff/manage/members/'+r.id+'/'+kind+'/proof'"/></view>
    </template>
    <template v-if="module==='cases'">
     <view class="line"><text class="record-title">{{caseType(r.type)}}</text><text class="tag">{{caseLabel(r)}}</text></view><text class="hint">顾客 {{caseCustomer(r)}}</text><text class="hint" selectable>订单 {{r.order_no}}</text>
     <text v-for="i in parseRows(r.items_json)" :key="i.id" class="item-line">{{i.name}} {{i.spec}} × {{i.quantity}}</text><text class="hint">原因：{{r.reason}}</text><text v-if="r.return_tracking" class="hint" selectable>寄回：{{r.return_carrier}} {{r.return_tracking}}</text><text v-if="r.return_due_at&&r.status==='awaiting_return'" class="hint">寄回截止 {{formatDate(r.return_due_at)}}</text><text v-if="r.replacement_tracking" class="hint" selectable>补发：{{r.replacement_carrier}} {{r.replacement_tracking}}</text><text v-if="r.note" class="hint">处理说明：{{r.note}}</text>
     <CaseProofs :case-id="r.id" :count="caseProofCount(r)" staff/>
     <view class="line"><text class="strong">{{['refund','return'].includes(r.type)?'退款金额 '+yuan(r.amount):caseType(r.type)+'不退款'}}</text><button v-if="me.canHandleCases&&caseActions(r).length&&!r.self" class="small-button" :disabled="busy||opening===r.id" @click="editCase(r)">{{opening===r.id?'正在打开…':'处理售后'}}</button><text v-if="me.canHandleCases&&caseActions(r).length&&r.self" class="hint">本人订单的售后请由其他同事处理</text></view>
    </template>
    <template v-if="module==='withdrawals'">
     <view class="line"><text class="record-title">{{r.realName||r.nickname||'推广员'}}</text><text class="tag">{{r.closedKind?'已关闭，金额已退回':withdrawalStatus(r)}}</text></view><text class="hint">会员编号 {{r.member_id}}{{r.phoneTail?' · 手机尾号 '+r.phoneTail:''}}{{r.realName&&r.nickname&&r.nickname!==r.realName?' · 微信昵称 '+r.nickname:''}}</text><text v-if="withdrawalReleased(r)" class="hint">申请 {{yuan(r.amount)}} · 没有扣费，已全额退回可提现佣金</text><template v-else><text class="hint">申请 {{yuan(r.amount)}} · {{withdrawalPaid(r)?'实际到账':'预计到账'}} {{yuan(netWithdrawal(r))}}</text><text class="hint">代扣税费 {{yuan(r.tax_amount)}}{{Number(r.tax_rate)>0?'（'+taxRateText(r.tax_rate)+'）':''}} · 平台服务费 {{yuan(r.service_fee)}}{{Number(r.service_rate)>0?'（'+taxRateText(r.service_rate)+'）':''}} · 手续费 {{yuan(r.fee)}}</text></template><text class="hint">{{formatDate(r.created_at)}}</text><text v-if="r.staffNote||r.transfer_note||r.note" class="hint">{{r.staffNote||r.transfer_note||r.note}}</text>
     <text v-if="r.withdrawalUnavailableReason" class="notice">{{r.withdrawalUnavailableReason}}</text><text v-else-if="r.review_status==='pending'&&r.canReject&&!r.canApprove&&!r.canQuery" class="notice">当前暂不能发起微信转账（商家转账未开通或已暂停），可以先拒绝，或等开通后再审核。</text><text v-if="r.closeBlock&&r.closeBlock!==r.withdrawalUnavailableReason" class="notice">{{r.closeBlock}}</text>
     <view class="actions"><button v-if="r.canApprove" class="small-button" :disabled="busy" @click="editWithdrawal(r,'approve')">审核转账</button><button v-if="r.canReject" class="small-button" :disabled="busy" @click="editWithdrawal(r,'rejected')">拒绝 / 取消</button><button v-if="r.canQuery" class="small-button" :disabled="busy" @click="queryWithdrawal(r)">查询转账结果</button><button v-if="r.canClose" class="small-button" :disabled="busy" @click="editWithdrawal(r,'close')">核实后关闭并退回</button></view>
    </template>
   </view>
   <button v-if="visibleRows.length<filtered.length" class="secondary" @click="limit+=25">加载更多（共 {{filtered.length}} 条）</button>
  </template>
 </view>
</template>
<script>
import CaseProofs from '../../../components/CaseProofs.vue'
import {request,getToken,asset} from '../../../services/shop'
import {yuan} from '../../../services/staff-workbench'
import {withdrawalReleased,withdrawalPaid,taxRateText} from '../../../services/withdrawal-amount'
import {formatDate} from '../../../services/display.js'
import {caseProofCount} from '../../../services/case-proofs'
import {MANAGEMENT_MODULES,moduleHint,parseObject,parseRows,yuanToFen,enabled,caseActions,caseMayRefund,caseStatus,caseType,caseLabel,caseCustomer,casePending,memberName,applicationState,stockOperator,withdrawalStatus,withdrawalWho,netWithdrawal,monthDates,cashDateError,stockMovement,productConfirm,stockConfirm} from '../services/staff-management'
// 售后要选仓库时读到的仓库列表，在本模块内用两分钟（连续处理几单不用每次都等整份库存数据）。
const WAREHOUSE_TTL=120000
const ROOT='/staff/manage/',ACCESS=/绑定|权限|无权|登录/,ask=(title,content)=>new Promise(resolve=>uni.showModal({title,content,confirmText:'确认处理',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))
export default {
 components:{CaseProofs},props:{module:{required:true},me:{required:true}},emits:['access-change','busy'],
 data(){const [from,to]=monthDates();return{rows:[],movements:[],movementsTruncated:false,stockHistory:false,warehouses:[],loaded:false,loading:false,busy:false,moduleReloadQueued:false,error:'',keyword:'',pendingOnly:true,limit:25,editor:null,formError:'',uncertain:false,sequence:0,editorSequence:0,opening:null,warehousesAt:0,from,to,cashPage:1,cashData:{}}},
 computed:{
  moduleInfo(){return MANAGEMENT_MODULES.find(m=>m.key===this.module)||{}},
  filtered(){const term=this.keyword.trim().toLowerCase();return (this.module==='stocks'&&this.stockHistory?this.movements:this.rows).filter(r=>{
   if(term&&!JSON.stringify(r).toLowerCase().includes(term))return false
   if(!this.pendingOnly)return true
   if(this.module==='members')return ['enterprise_state','distributor_state'].some(k=>r[k]==='pending')
   if(this.module==='cases')return casePending(r)
   if(this.module==='withdrawals')return r.canApprove||r.canReject||r.canQuery&&!['SUCCESS','FAIL','CANCELLED'].includes(r.transfer_state)||r.canClose
   return true
  })},
  visibleRows(){return this.filtered.slice(0,this.limit)},
  cashTotals(){return (this.cashData.bySource||[]).reduce((sum,r)=>({received:sum.received+Number(r.received||0),refunded:sum.refunded+Number(r.refunded||0),net:sum.net+Number(r.received||0)-Number(r.refunded||0)}),{received:0,refunded:0,net:0})}
 },
 // WeChat reuses this component when its module prop changes; a Vue key does not remount it there.
 watch:{module(){this.reloadModule()}},
 mounted(){this.refresh()},beforeUnmount(){this.sequence++;this.editorSequence++},
 methods:{asset,yuan,enabled,formatDate,withdrawalReleased,withdrawalPaid,taxRateText,moduleHint,parseObject,parseRows,caseActions,caseStatus,caseType,caseLabel,caseCustomer,memberName,applicationState,stockOperator,caseProofCount,withdrawalStatus,netWithdrawal,stockMovement,
  setPending(value){this.pendingOnly=value;if(this.module==='members'){
   // A visible filter can change while the previous list refresh is in flight.
   // Invalidate that response and load the latest selection instead of dropping the click.
   this.sequence++;this.loading=false;this.loaded=false;return this.refresh()
  }},
  warehouseActive(id){return this.warehouses.some(w=>Number(w.id)===Number(id))},
  sourceLabel(k){return ({wechat_order:'微信支付',recharge:'小程序充值',partner_fee:'加盟款',bank:'对公转账',store_topup:'门店充值'})[k]||k},
  reloadModule(){
   this.sequence++;this.editorSequence++
   if(this.busy){this.moduleReloadQueued=true;return}
   const [from,to]=monthDates()
   Object.assign(this,{moduleReloadQueued:false,rows:[],movements:[],movementsTruncated:false,stockHistory:false,warehouses:[],loaded:false,loading:false,error:'',keyword:'',pendingOnly:true,limit:25,editor:null,formError:'',uncertain:false,opening:null,warehousesAt:0,from,to,cashPage:1,cashData:{}})
   return this.refresh()
  },
  async refresh(){if(this.busy||this.loading)return;if(this.module==='cash')return this.loadCash(1);const module=this.module,seq=++this.sequence;this.loading=true;this.error='';try{const result=await request(ROOT+module+(module==='members'&&this.pendingOnly?'?pendingOnly=true':''));if(seq!==this.sequence||module!==this.module)return;this.rows=module==='stocks'?(result.stocks||[]):Array.isArray(result)?result:[];if(module==='stocks'){this.warehouses=(result.warehouses||[]).filter(w=>enabled(w.enabled));this.movements=result.movements||[];this.movementsTruncated=!!result.movementsTruncated;}this.loaded=true;this.limit=25}catch(e){if(seq===this.sequence&&module===this.module)this.fail(e)}finally{if(seq===this.sequence&&module===this.module)this.loading=false}},
  // A write's own re-read: a list read that left before the write carries the old state, so it is voided, not waited for.
  restartRefresh(){this.sequence++;this.loading=false;return this.refresh()},
  async loadCash(page=1,paging=false){if(this.busy||this.loading||this.module!=='cash')return;const from=paging?this.cashData.period?.from:this.from,to=paging?this.cashData.period?.to:this.to;const problem=cashDateError(from,to);if(problem){this.error=problem;return}const seq=++this.sequence;this.loading=true;this.error='';try{const result=await request(ROOT+'cash?from='+from+'&to='+to+'&page='+page+'&size=20');if(seq===this.sequence&&this.module==='cash'){this.cashData={...result,period:{from,to}};this.cashPage=page;this.loaded=true}}catch(e){if(seq===this.sequence&&this.module==='cash')this.fail(e)}finally{if(seq===this.sequence&&this.module==='cash')this.loading=false}},
  fail(e){if(e.staleSession)return;this.error=e.message||'暂时读取不到，请重试';if(ACCESS.test(this.error)||!getToken())this.$emit('access-change')},
  open(editor){if(this.busy)return;this.editorSequence++;this.opening=null;this.editor=editor;this.formError='';this.uncertain=false;this.error='';this.$nextTick(()=>uni.pageScrollTo({scrollTop:0,duration:0}))},
  closeEditor(){if(!this.busy){this.editorSequence++;this.opening=null;this.editor=null;this.formError='';this.uncertain=false}},
  closeAndRefresh(){this.closeEditor();this.restartRefresh()},
  editProduct(r){this.open({title:'编辑商品',subtitle:r.product_code,row:r,name:r.name,spec:r.spec,price:(Number(r.price)/100).toFixed(2),detail:r.detail||'',enabled:enabled(r.enabled)})},
  editStock(r){this.open({title:'调整可售库存',subtitle:r.product_name,row:r,delta:'',note:'',requestKey:'mobile_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12)})},
  editMember(r,kind){this.open({title:kind==='distributor'?'审核分销资格':'审核企业认证',subtitle:memberName(r,kind)+' · 会员编号 '+r.id,row:r,kind,state:'approved',note:''})},
  async editCase(r){
   if(this.busy||this.module!=='cases')return
   // Only a later 处理售后, closing, another module or another account voids this read; a list refresh does not.
   const token=getToken(),intent=++this.editorSequence
   this.opening=null
   if(['returned','awaiting_reship'].includes(r.status)&&!(this.warehouses.length&&Date.now()-this.warehousesAt<WAREHOUSE_TTL)){
    this.opening=r.id
    try{
     const result=await request(ROOT+'stocks')
     if(token!==getToken()||intent!==this.editorSequence||this.module!=='cases')return
     this.warehouses=(result.warehouses||[]).filter(w=>enabled(w.enabled));this.warehousesAt=Date.now()
    }catch(e){
     // A superseded editor cannot publish a late read error; a current-session
     // access refusal still needs the parent to refresh identity and permissions.
     if(this.module==='cases'&&(!getToken()||token===getToken())&&(intent===this.editorSequence||ACCESS.test(e.message||'')||!getToken()))this.fail(e)
     return
    }finally{if(intent===this.editorSequence)this.opening=null}
   }
   this.open({title:'处理'+caseType(r.type),subtitle:caseCustomer(r)+' · 订单 '+r.order_no,row:r,action:caseActions(r)[0][0],returnAddress:'',days:'7',warehouseIndex:0,inspection:parseRows(r.items_json).map(i=>({productId:i.productId,name:i.name,quantity:i.quantity,accepted:'0'})),carrier:'',tracking:'',note:''})
  },
  editWithdrawal(r,state){this.open({title:state==='approve'?'审核并发起转账':state==='close'?'核实关闭并退回':'拒绝或取消提现',subtitle:(r.realName||r.nickname||'推广员')+' · 会员编号 '+r.member_id,row:r,state,note:''})},
  body(){const e=this.editor;if(this.module==='products'){if(e.name.trim().length<2)throw Error('商品名称至少2个字');if(!e.spec.trim()&&String(e.row.spec||'').trim())throw Error('请填写商品规格（例如 100ml）');return{version:e.row.version,base:{name:e.row.name,spec:e.row.spec,price:e.row.price,detail:e.row.detail,enabled:enabled(e.row.enabled)},name:e.name.trim(),spec:e.spec.trim(),price:yuanToFen(e.price),detail:e.detail,enabled:e.enabled}}
   const note=e.note.trim();if(note.length<2)throw Error('请填写至少2字的处理依据');
   if(this.module==='stocks'){if(!/^-?\d+$/.test(e.delta)||!Number.isSafeInteger(Number(e.delta))||Number(e.delta)===0)throw Error('请输入非零的整数件数');return{productId:e.row.product_id,warehouseId:e.row.warehouse_id,channel:e.row.channel,delta:Number(e.delta),note,requestKey:e.requestKey}}
   if(this.module==='members'||this.module==='withdrawals')return{state:e.state,note}
   const body={action:e.action,note};if(e.action==='approve'&&['return','exchange'].includes(e.row.type)){if(e.returnAddress.trim().length<5)throw Error('请填写完整寄回地址和联系人');body.returnAddress=e.returnAddress.trim()}
   if(e.action==='extend'){if(!/^\d+$/.test(e.days)||Number(e.days)<1||Number(e.days)>365)throw Error('延长时间为1至365天');body.days=Number(e.days)}
   if(['received','reship'].includes(e.action)){body.warehouseId=this.warehouses[e.warehouseIndex]?.id;if(!body.warehouseId)throw Error('请选择有效仓库')}
   if(e.action==='reship'){if(!e.carrier.trim()||!e.tracking.trim())throw Error('请填写物流公司和运单号');body.carrier=e.carrier.trim();body.tracking=e.tracking.trim()}
   if(e.action==='inspect'){if(e.inspection.some(i=>!/^\d+$/.test(String(i.accepted))||Number(i.accepted)>Number(i.quantity)))throw Error('合格件数须为0至寄回件数之间的整数');body.inspection=e.inspection.map(i=>({productId:i.productId,accepted:Number(i.accepted)}))}
   return body
  },
  // 处理售后提交失败（例如所选仓库刚被停用）：当场重读仓库列表，编辑器里的选择跟着更新
  async reloadWarehouses(token){try{const result=await request(ROOT+'stocks');if(token!==getToken()||this.module!=='cases'||!this.editor)return;const keep=this.warehouses[this.editor.warehouseIndex]?.id;this.warehouses=(result.warehouses||[]).filter(w=>enabled(w.enabled));this.warehousesAt=Date.now();const index=this.warehouses.findIndex(w=>Number(w.id)===Number(keep));this.editor.warehouseIndex=index<0?0:index}catch{}},
  async submit(){if(this.busy||!this.editor||this.uncertain&&this.module!=='stocks')return;let body;try{body=this.body()}catch(e){this.formError=e.message;return}
   const editor=this.editor,module=this.module,token=getToken();let reread=false;this.busy=true;this.$emit('busy',true);this.formError='';
   try{
    let confirm='确认保存这次修改？';if(this.module==='products')confirm=productConfirm(editor.row,body);else if(this.module==='stocks')confirm=stockConfirm(editor.row,body.delta);else if(this.module==='withdrawals')confirm=body.state==='approve'?'将向'+withdrawalWho(editor.row)+'发起 '+yuan(netWithdrawal(editor.row))+' 微信转账，确认审核？':body.state==='close'?'确认向微信核实后关闭'+withdrawalWho(editor.row)+'这笔 '+yuan(editor.row.amount)+' 的提现，并退回可提现佣金？':'确认'+(editor.row.review_status==='approved'?'取消':'拒绝')+withdrawalWho(editor.row)+'这笔 '+yuan(editor.row.amount)+' 的提现，并退回可提现佣金？';else if(this.module==='members')confirm='确认'+(body.state==='approved'?'通过':'驳回')+memberName(editor.row,editor.kind)+'（会员编号 '+editor.row.id+'）的'+(editor.kind==='enterprise'?'企业认证':'分销商申请')+'？';else if(this.module==='cases')confirm='确定对'+caseCustomer(editor.row)+'的'+caseType(editor.row.type)+'执行「'+(caseActions(editor.row).find(x=>x[0]===body.action)?.[1]||'处理')+'」？'+(caseMayRefund(editor.row.type,body.action)?' 本次可能发起 '+yuan(editor.row.amount)+' 退款。':'');
    if(!await ask(editor.title,confirm))return;if(token!==getToken()){this.$emit('access-change');return}if(module!==this.module||this.moduleReloadQueued)return;
    if(this.uncertain&&module==='stocks'&&editor.sentBody)body=editor.sentBody;else editor.sentBody={...body};
    const path=module==='stocks'?'stocks':module==='members'?'members/'+editor.row.id+'/'+editor.kind:module+'/'+editor.row.id;
    await request(ROOT+path,'POST',body);if(token!==getToken()||module!==this.module||this.moduleReloadQueued)return;this.editor=null;this.uncertain=false;uni.showToast({title:'已提交，请以最新状态为准',icon:'none'});
   }catch(e){if(e.staleSession||module!==this.module||this.moduleReloadQueued)return;const message=e.message||'提交失败，请重试';this.uncertain=!!e.uncertain;this.warehousesAt=0;if(module==='cases'&&!this.uncertain&&editor.row&&['returned','awaiting_reship'].includes(editor.row.status))this.reloadWarehouses(token);/* 库存调整明确失败（例如仓库刚被停用）：表单照旧写明原因，列表在后台重读（第 16 批补缺口 K08b） */if(module==='stocks'&&!this.uncertain&&!ACCESS.test(message)&&getToken())reread=true;this.formError=this.uncertain?'':message;if(ACCESS.test(message)||!getToken())this.$emit('access-change')}
   finally{this.busy=false;this.$emit('busy',false);if(this.moduleReloadQueued)this.reloadModule();else if(!this.editor||reread)this.restartRefresh()}
  },
  async queryWithdrawal(r){if(this.busy||this.module!=='withdrawals')return;const seq=this.sequence;this.busy=true;this.$emit('busy',true);let failure;try{await request(ROOT+'withdrawals/'+r.id,'POST',{state:'query',note:'手机管理查询转账结果'})}catch(e){failure=e}finally{const current=seq===this.sequence&&this.module==='withdrawals';this.busy=false;this.$emit('busy',false);if(this.moduleReloadQueued)await this.reloadModule();else await this.restartRefresh();if(failure&&current)this.fail(failure)}}
 }
}
</script>
<style scoped>
@import '../../../styles/component-base.css';
.management-panel{padding:18px 12px 36px;color:var(--shop-text,#2b424f)}.panel-heading,.line{display:flex;align-items:center;justify-content:space-between;gap:12px}.panel-heading{margin-bottom:18px}.panel-title{font-size:20px;font-weight:600;display:block}.hint{display:block;color:var(--shop-muted,#59727f);font-size:12px;line-height:1.8;overflow-wrap:anywhere}.warn-note{color:#b54708}.record{background:var(--shop-surface,#fdfeff);padding:16px;margin:12px 0;border:1px solid var(--shop-border,#d5e6ee);border-radius:12px}.record-title{display:block;font-size:15px;font-weight:600;line-height:1.6}.strong{font-weight:600;color:var(--shop-ink,#28546c)}.tag{font-size:11px;color:var(--shop-ink,#28546c);white-space:nowrap}.product-row{display:flex;gap:12px;align-items:center}.product-row image{width:56px;height:64px;border-radius:6px}.product-row>view{flex:1;min-width:0}.line{margin-top:10px;font-size:13px;line-height:1.7}.stock-values{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;font-size:13px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.item-line{display:block;font-size:13px;line-height:1.8;margin-top:8px}.empty{padding:40px 15px;text-align:center;font-size:14px;color:var(--shop-muted,#59727f)}
button{color:var(--shop-ink,#28546c);font-size:14px;margin:0;background:var(--shop-soft,#eaf5fb);border-radius:8px;line-height:1.5;padding:10px 14px}button::after{border:0}button[disabled]{opacity:.55}.small-button{font-size:12px;min-height:38px;padding:9px 12px;flex-shrink:0}.primary{background:var(--shop-accent,#c7e8f5);width:100%;margin-top:20px;min-height:46px}.secondary{width:100%;margin-top:14px;min-height:44px}.text-button{background:transparent;text-align:left;padding:0;min-height:36px;font-size:13px}.choices{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.choices button{background:var(--shop-surface,#fdfeff);border:1px solid var(--shop-border,#d5e6ee);font-size:13px}.choices .chosen{background:var(--shop-accent,#c7e8f5);border-color:var(--shop-control,#417c9a)}
input,textarea,.picker{width:100%;background:var(--shop-surface,#fdfeff);border:1px solid var(--shop-border,#d5e6ee);border-radius:8px;padding:10px 12px;font-size:14px;min-height:44px;box-sizing:border-box;color:var(--shop-text,#2b424f)}textarea{min-height:96px;line-height:1.8}.label{display:block;font-size:13px;margin:18px 0 8px}.value{display:block;line-height:1.8;font-size:14px}.editor-title{display:block;font-size:20px;font-weight:600;margin:12px 0 6px}.editor .hint{margin:8px 0}.error{display:block;padding:12px;background:#fff0ec;color:#934a39;font-size:13px;line-height:1.8;margin:12px 0;border-radius:8px}.notice{display:block;font-size:12px;line-height:1.8;color:#865536;margin-top:10px}.money-lines{background:var(--shop-soft,#eaf5fb);padding:16px;border-radius:10px;margin:20px 0}.money-lines>view{display:flex;justify-content:space-between;font-size:14px;line-height:2.3}.date-row{display:flex;align-items:center;gap:7px;font-size:12px;margin-bottom:12px}.date-row picker{flex:1;min-width:0}.date-row .picker{font-size:12px;padding:10px 6px;white-space:nowrap}.cash-totals{background:var(--shop-accent,#c7e8f5);padding:18px 14px;border-radius:12px;margin-top:18px}.cash-totals>view{display:flex;justify-content:space-between;font-size:14px;line-height:2.4}.cash-totals>view:last-child{font-weight:600}.section-label{display:block;font-weight:600;margin:26px 0 12px}.pager{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;margin:18px 0}
</style>
