<template>
 <view class="module-panel dashboard">
  <view class="panel-heading"><view><text class="panel-title">{{info.title}}</text><text class="hint">{{info.hint}}</text></view><button class="small-button" :disabled="loading||busy" @click="refresh">刷新</button></view>
  <view class="choices range-switch"><button v-for="r in ranges" :key="r.key" :class="{chosen:range===r.key}" :aria-pressed="range===r.key" @click="choose(r.key)">{{r.label}}</button></view>
  <template v-if="range==='custom'">
   <view class="date-row"><picker mode="date" :value="from" start="2020-01-01" :end="today" @change="from=$event.detail.value;rangeError=''"><view class="picker">{{from}}</view></picker><text>至</text><picker mode="date" :value="to" start="2020-01-01" :end="today" @change="to=$event.detail.value;rangeError=''"><view class="picker">{{to}}</view></picker><button class="small-button" @click="query">查询</button></view>
   <text class="hint">自选最多 92 天，按北京时间整天统计。</text>
  </template>
  <text v-if="rangeError" class="error" role="alert">{{rangeError}}</text>
  <text v-if="error" class="error" role="alert">{{loaded?'经营数据没有更新成功：'+error+'。下面仍是 '+periodText(period)+' 的数据。':error}}</text>
  <view v-if="loading&&!loaded" class="empty">正在统计…</view>
  <view v-else-if="!loaded" class="empty">数据尚未读取成功，请点击上方刷新重试。</view>
  <template v-else>
   <text class="hint period">{{periodText(period)}}（北京时间）{{loading?' · 正在更新…':' · '+updatedAt+' 更新'}}</text>

   <text class="section-label">现在待办</text>
   <text class="hint">{{notes.todo}}</text>
   <view class="todo-grid"><view v-for="t in todos" :key="t.key" class="todo" :class="{muted:t.count===0}" role="button" :aria-label="t.label+' '+t.count" @click="open(t)"><text class="todo-value">{{t.count}}</text><text class="todo-label">{{t.label}}</text><text class="todo-action">{{t.action}}</text></view></view>

   <text class="section-label">销售与收款</text>
   <view class="figure-grid"><view v-for="f in figures" :key="f.key" class="figure" :class="{wide:f.wide}"><text class="figure-label">{{f.label}}</text><text class="figure-value">{{f.value}}</text><text v-if="f.extra" class="figure-extra">{{f.extra}}</text><text v-if="f.extra2" class="figure-extra">{{f.extra2}}</text><text class="figure-note">{{f.note}}</text></view></view>

   <text class="section-label">商品销量前 10</text>
   <text class="hint">{{notes.products}}</text>
   <view v-for="r in products" :key="'p'+r.key" class="rank-row"><view class="rank-head"><text class="rank-no" :class="{top:r.rank<=3}">{{r.rank}}</text><text class="rank-name">{{r.name}}</text><text class="rank-value">{{r.right}}</text></view><view class="bar-track"><view class="bar-fill" :style="{width:r.width}"></view></view><text class="rank-sub">{{r.sub}}</text></view>
   <view v-if="!products.length" class="empty">这段时间还没有卖出的商品</view>

   <text class="section-label">分销业绩前 10</text>
   <text class="hint">{{notes.distributors}}</text>
   <view v-for="r in ranking" :key="'d'+r.key" class="rank-row"><view class="rank-head"><text class="rank-no" :class="{top:r.rank<=3}">{{r.rank}}</text><text class="rank-name">{{r.name}}</text><text class="rank-value">{{r.right}}</text></view><view class="bar-track"><view class="bar-fill alt" :style="{width:r.width}"></view></view><text class="rank-sub">{{r.sub}}</text></view>
   <view v-if="!ranking.length" class="empty">这段时间还没有推广带来的订单</view>
   <text v-if="others" class="hint">{{others}}</text>

   <text class="section-label">佣金与提现</text>
   <view v-for="m in money" :key="m.key" class="record"><view class="line"><text>{{m.label}}</text><text class="strong">{{m.value}}</text></view><text class="hint">{{m.note}}</text></view>
   <text class="hint">不含测试订单；在电脑后台选同样的日期，数字应一致。</text>
  </template>
 </view>
</template>
<script>
import {request,getToken} from '../../../services/shop'
import {formatDate} from '../../../services/display'
import {MANAGEMENT_MODULES,beijingToday} from '../services/staff-management'
import {RANGES,monthStart,dashboardRangeError,rangeQuery,periodText,dashboardFigures,commissionLines,productBars,distributorBars,unattributedText,todoItems,DASHBOARD_NOTES} from '../services/staff-dashboard'
export default {
 props:{module:{required:true},me:{required:true}},
 emits:['access-change','busy','open-module'],
 data(){const today=beijingToday();return{range:'month',from:monthStart(today),to:today,today,rangeError:'',data:null,loaded:false,loading:false,error:'',sequence:0,updatedAt:'',busy:false}},
 computed:{
  info(){return MANAGEMENT_MODULES.find(m=>m.key===this.module)||{}},
  ranges(){return RANGES},
  notes(){return DASHBOARD_NOTES},
  period(){return this.data?.range||{}},
  figures(){return dashboardFigures(this.data)},
  money(){return commissionLines(this.data)},
  products(){return productBars(this.data?.products)},
  ranking(){return distributorBars(this.data?.distributors)},
  others(){return unattributedText(this.data?.distributorsOther)},
  todos(){return todoItems(this.data?.todo,this.me)}
 },
 mounted(){this.load()},
 beforeUnmount(){this.sequence++},
 methods:{
  periodText,
  refresh(){return this.load()},
  choose(key){if(key==='custom'){this.range='custom';this.rangeError='';return}this.range=key;this.rangeError='';this.load()},
  query(){this.today=beijingToday();const p=dashboardRangeError(this.from,this.to,this.today);this.rangeError=p;if(!p)this.load()},
  // A newer range always wins: an answer that arrives after a newer request started is dropped.
  async load(){
   const seq=++this.sequence;this.loading=true;this.error=''
   try{const r=await request('/staff/manage/dashboard?'+rangeQuery(this.range,this.from,this.to));if(seq!==this.sequence)return;this.data=r||{};this.loaded=true;this.updatedAt=formatDate(new Date().toISOString()).slice(-5)}
   catch(e){if(seq===this.sequence)this.fail(e)}
   finally{if(seq===this.sequence)this.loading=false}
  },
  fail(e){if(e.staleSession)return;this.error=e.message||'暂时读取不到，请重试';if(/绑定|权限|无权|登录/.test(this.error))this.$emit('access-change')},
  open(t){if(!t.target||!t.allowed){uni.showToast({title:t.hint,icon:'none',duration:3000});return}this.$emit('open-module',t.target)}
 }
}
</script>
<style scoped>
@import '../../../styles/component-base.css';@import '../styles/staff-module.css';
.range-switch button{flex:1;min-width:0}
.period{margin-top:6px}
</style>
