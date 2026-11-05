// 经营数据 (phone). Pure rules only: no imports, no uni, no network, so node tests can load this file directly.
// The server sends numbers only (money in fen); every explanation shown next to a number lives here.
export function money(fen){const v=Number(fen);if(!Number.isFinite(v))return '¥0.00';const sign=v<0?'-':'',[w,c]=(Math.abs(Math.round(v))/100).toFixed(2).split('.');return sign+'¥'+w.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+c}
const count=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?Math.floor(n):0}
const readDay=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return NaN;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s?d.getTime():NaN}

export const RANGES=[{key:'today',label:'今天'},{key:'month',label:'本月'},{key:'custom',label:'自选'}]
export const MAX_DAYS=92
export const monthStart=today=>String(today||'').slice(0,8)+'01'
// Same checks and words as the server, so a range the server would refuse is never sent.
export function dashboardRangeError(from,to,today){const a=readDay(from),b=readDay(to),t=readDay(today);if(!Number.isFinite(a)||!Number.isFinite(b))return '请选择开始和结束日期';if(b<a)return '结束日期不能早于开始日期';if(Number.isFinite(t)&&b>t)return '结束日期不能晚于今天';if(a<readDay('2020-01-01'))return '开始日期不能早于2020年1月1日';if((b-a)/86400000+1>MAX_DAYS)return '一次最多查看92天，请缩短日期范围';return ''}
export function rangeQuery(range,from,to){return range==='custom'?'range=custom&from='+from+'&to='+to:'range='+(range==='today'?'today':'month')}
export const periodText=p=>!p||!p.from?'':p.from===p.to?p.from:p.from+' 至 '+p.to
// CSS bar widths: the largest value fills the track; any positive value stays visible (at least 2%).
export function barWidths(values){const n=(Array.isArray(values)?values:[]).map(v=>Math.max(0,Number(v)||0)),max=Math.max(0,...n);return n.map(v=>max<=0||v<=0?'0%':Math.max(2,Math.round(v/max*1000)/10)+'%')}
export const DASHBOARD_NOTES={
 sales:'按付款日期统计的订单付款（含用余额付的部分），减去这段时间内发生的退款，不含测试订单；和电脑后台「经营报表 → 经营分析」同一时间段的当期净额一致',
 cash:'已经确认到账的钱：订单里用微信付的部分、小程序充值、登记的加盟款、财务确认的对公转账、店长或财务登记的门店充值，减去退回的部分；用余额付的部分不算（充值时已算过）；和电脑后台「经营报表 → 现金实收」一致',
 refunded:'这段时间发生的退款，含退回余额的部分，按退款时间统计',
 orders:'这段时间付款的订单笔数',
 average:'当期付款 ÷ 付款订单数（未扣退款）',
 newCustomers:'这段时间新注册的会员，不含测试号和演示号；不是付款客户数',
 products:'按商品付款减退款的金额排序，件数为付款件数减退款件数；零售和企业采购合并计算，不含运费',
 distributors:'按下单时记录的推广关系统计：有上一层推广人的算到上一层的团队，每单只算一次，按付款减退款排序；佣金是这位推广员本人这段时间新增的佣金',
 generated:'这段时间新产生的佣金，减去因退款扣回的部分',
 paidOut:'这段时间已转到推广员微信零钱的提现，按到账时间统计',
 pendingReview:'现在还在等审核的提现申请，不受上面日期影响',
 todo:'待办是现在的数量，不受上面日期影响，点一下去处理。'
}
export function dashboardFigures(d){if(!d)return [];const s=d.sales||{},c=d.cash||{},parts=(Array.isArray(c.sources)?c.sources:[]).filter(x=>Number(x?.received)>0).map(x=>String(x.label||'')+' '+money(x.received));return [
 {key:'sales',label:'销售额',value:money(s.net),extra:'付款 '+money(s.paid)+' · 退款 '+money(s.refunded),extra2:'',note:DASHBOARD_NOTES.sales,wide:true},
 {key:'cash',label:'实收现金',value:money(c.received),extra:'退回 '+money(c.refunded)+' · 净收 '+money(c.net),extra2:parts.length?'其中 '+parts.join('、'):'',note:DASHBOARD_NOTES.cash,wide:true},
 {key:'refunded',label:'退款',value:money(s.refunded),extra:'',extra2:'',note:DASHBOARD_NOTES.refunded,wide:false},
 {key:'orders',label:'订单数',value:count(s.orders)+' 笔',extra:'',extra2:'',note:DASHBOARD_NOTES.orders,wide:false},
 {key:'average',label:'客单价',value:money(s.average),extra:'',extra2:'',note:DASHBOARD_NOTES.average,wide:false},
 {key:'newCustomers',label:'新客户',value:count(d.newCustomers)+' 位',extra:'',extra2:'',note:DASHBOARD_NOTES.newCustomers,wide:false}]}
export function commissionLines(d){const m=d?.commission||{},p=m.paidOut||{};return [
 {key:'generated',label:'本期新增佣金',value:money(m.generated),note:DASHBOARD_NOTES.generated},
 {key:'paidOut',label:'本期已打款提现',value:money(p.amount),note:DASHBOARD_NOTES.paidOut+'；实际到账 '+money(p.received)+'（已扣手续费 '+money(p.fees)+'、代扣税费 '+money(p.taxes)+'、平台服务费 '+money(p.serviceFees)+'）'},
 {key:'pendingReview',label:'待审核提现',value:count(m.pendingReview?.count)+' 笔 · '+money(m.pendingReview?.amount),note:DASHBOARD_NOTES.pendingReview}]}
export function productBars(rows){const list=(Array.isArray(rows)?rows:[]).slice(0,10),w=barWidths(list.map(r=>r.net));return list.map((r,i)=>({key:String(r.productId??i),rank:i+1,name:String(r.name||'未命名商品'),right:money(r.net),sub:count(r.quantity)+' 件 · '+count(r.orders)+' 单',width:w[i]}))}
export function distributorBars(rows){const list=(Array.isArray(rows)?rows:[]).slice(0,10),w=barWidths(list.map(r=>r.net));return list.map((r,i)=>({key:String(r.memberId??i),rank:i+1,name:String(r.name||'').trim()||'未填写姓名',right:money(r.net),sub:count(r.orders)+' 单 · 佣金 '+money(r.commission),width:w[i]}))}
export function unattributedText(rows){const t=(Array.isArray(rows)?rows:[]).filter(u=>count(u?.orders)>0||Number(u?.net)>0).map(u=>String(u.name||'没有推广人的订单')+' '+count(u.orders)+' 单 · '+money(u.net));return t.length?t.join('；')+'（不参与排名）':''}
const TODOS=[
 {key:'pendingShipment',label:'待发货',target:{module:'orders',view:'shipping'},needs:['canViewOrders','canShip']},
 {key:'pendingPickup',label:'待自提',target:{module:'orders',view:'pickup'},needs:['canViewOrders','canCollectPickup']},
 {key:'afterSalesOpen',label:'进行中售后',target:{module:'cases'},needs:['canViewCases']},
 {key:'withdrawalsToReview',label:'待审提现',target:{module:'withdrawals'},needs:['canReviewWithdrawals']},
 {key:'applications',label:'待审分销/企业申请',target:{module:'members'},needs:['canViewCustomers']},
 {key:'wechatShippingFailed',label:'微信发货需处理',target:null,needs:[]}]
// A to-do only jumps to a module this person may open; otherwise it says who handles it.
export function todoItems(todo,me){const t=todo||{};return TODOS.map(x=>{const n=count(t[x.key]),allowed=!!x.target&&x.needs.every(k=>me?.[k]===true);return {key:x.key,label:x.label,count:n,target:x.target,allowed,action:n===0?'暂无':!x.target?'在电脑后台处理':allowed?'去处理 ›':'由同事处理',hint:!x.target?'请在电脑后台「配送与门店自提 → 微信发货信息」里处理':allowed?'':'这类事项由有相应权限的同事处理'}})}
