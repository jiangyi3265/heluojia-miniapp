export const MANAGEMENT_MODULES=[
 {key:'orders',title:'订单发货',hint:'发货与自提核销',icon:'truck',capability:'canViewOrders'},
 {key:'lookup',title:'客户订单',hint:'按手机号、昵称或订单号查找',icon:'search',capability:'canLookupCustomers'},
 {key:'customers',title:'客户档案',hint:'全部客户、门店余额与充值',icon:'user',capability:'canViewCustomerArchive',edit:'canTopUpCustomers',readOnly:'只能查看客户档案，充值由店长或财务登记',search:'搜索姓名、昵称、手机号或会员编号'},
 {key:'cases',title:'售后处理',hint:'退款、退换与补发',icon:'refund',capability:'canViewCases',edit:'canHandleCases',readOnly:'只能查看售后进度，处理由有权限的同事完成',search:'搜索订单号、商品或顾客昵称'},
 {key:'members',title:'客户审核',hint:'企业与分销申请',icon:'user',capability:'canViewCustomers',edit:'canReviewCustomers',readOnly:'只能查看申请，审核由有权限的同事完成',search:'搜索姓名、手机号或会员编号'},
 {key:'products',title:'商品管理',hint:'改价、编辑与上下架',icon:'bag',capability:'canViewProducts',edit:'canEditProducts',readOnly:'只能查看商品，改价和上下架由有权限的同事完成',search:'搜索商品名称、规格或编号'},
 {key:'stocks',title:'库存管理',hint:'分仓库存与增减记录',icon:'grid',capability:'canViewStock',edit:'canAdjustStock',readOnly:'只能查看库存和流水，调整由有权限的同事完成',search:'搜索商品、仓库或订单号'},
 {key:'withdrawals',title:'提现审核',hint:'审核与转账进度',icon:'wallet',capability:'canReviewWithdrawals',search:'搜索姓名、会员编号或手机尾号'},
 {key:'cash',title:'收款报表',hint:'实收、退款与净收',icon:'wallet',capability:'canViewMoney'},
 {key:'dashboard',title:'经营数据',hint:'销售、收款、排行与待办',icon:'building',capability:'canViewDashboard'},
 {key:'distributors',title:'分销商',hint:'加盟款、拿货档位与佣金比例',icon:'share',capability:'canViewDistributors'},
 {key:'settings',title:'经营设置',hint:'提现、服务费与配送自提',icon:'settings',capability:'canViewShopSettings'}
]
// 标题下的一句话：没有改动权限的同事看到“只能查看”，不写他点不到的“改价、审核”
export const moduleHint=(info,me)=>info?.edit&&me?.[info.edit]!==true&&info.readOnly?info.readOnly:info?.hint||''
export const managementModules=me=>me?.bound===true?MANAGEMENT_MODULES.filter(m=>me[m.capability]===true):[]
// More than two rows of buttons: smaller icons and padding so the menu stays about 226px tall at 320px wide.
export const menuDense=modules=>Array.isArray(modules)&&modules.length>8
// Dates and clock times the shop uses are Beijing time on every phone, whatever the phone's own time zone.
export const beijingToday=(now=new Date())=>new Date(now.getTime()+8*3600000).toISOString().slice(0,10)
export const beijingClock=(now=new Date())=>new Date(now.getTime()+8*3600000).toISOString().slice(11,16)
export const parseObject=value=>{if(value&&typeof value==='object'&&!Array.isArray(value))return value;try{const parsed=JSON.parse(value||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return {}}}
export const parseRows=value=>{if(Array.isArray(value))return value;try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed:[]}catch{return []}}
export function yuanToFen(value){const s=String(value??'').trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('金额最多保留两位小数');const [whole,decimal='']=s.split('.'),fen=Number(whole)*100+Number(decimal.padEnd(2,'0'));if(!Number.isSafeInteger(fen)||fen<1||fen>100000000)throw Error('金额应在0.01至1,000,000元之间');return fen}
export const enabled=value=>value===true||value===1||value==='1'
export function caseActions(row){if(row.status==='awaiting_refund')return row.wechat_refund_state==='CLOSED'?[['retry_refund','重新发起微信退款']]:[];return ({pending:[['approve','通过申请'],['reject','驳回申请']],awaiting_return:[['extend','延长寄回时间'],['close','关闭售后（顾客未寄回）']],returned:[['received','确认收到退货']],inspecting:[['inspect','完成验收']],awaiting_reship:[['reship','填写补发物流']]})[row.status]||[]}
export const caseStatus=value=>({pending:'待审核',awaiting_return:'等待寄回',returned:'顾客已寄回',inspecting:'待验收',awaiting_reship:'等待补发',reshipped:'已补发',awaiting_refund:'退款处理中',refunded:'已退款',completed:'已完成',rejected:'已驳回'})[value]||value
// 这一步会不会发起退款：仅退款在“通过申请”时退；退货退款要等“完成验收”才退，“通过申请”只是请顾客寄回（第 16 批补缺口 S-08b）
export const caseMayRefund=(type,action)=>(type==='refund'&&action==='approve')||(type==='return'&&action==='inspect')
export const caseType=value=>({refund:'仅退款',return:'退货退款',exchange:'换货',resend:'补发'})[value]||value
// 列表标签：微信已关闭退款的单子没有退出任何钱，不能再显示“退款处理中”，要提醒财务重新发起
export const caseLabel=row=>row?.status==='awaiting_refund'&&row?.wechat_refund_state==='CLOSED'?'微信退款已关闭，待重新发起':caseStatus(row?.status)
// 审核卡片和确认弹窗称呼申请人：先用这次申请资料里的姓名，再用另一份申请的姓名；微信昵称默认都叫“新朋友”，只作兜底
export function memberName(row,kind='distributor'){const other=kind==='enterprise'?'distributor':'enterprise',name=[parseObject(row?.[kind+'_data']).name,parseObject(row?.[other+'_data']).name].map(v=>String(v??'').trim()).find(Boolean);return name||String(row?.nickname??'').trim()||'商城客户'}
export const applicationState=(state,kind)=>state==='rejected'&&kind==='distributor'?'未通过/已停用':({approved:'已通过',pending:'待审核',rejected:'已驳回',none:'未申请'})[state]||'未申请'
// 库存流水操作人：顾客下单占用时记的是会员编号，显示成“顾客下单（会员编号 N）”；员工账号、“系统”原样显示
export function stockOperator(row){const who=String(row?.operator_name??'').trim();return /^\d+$/.test(who)?(String(row?.reference_key??'').startsWith('reserve_')?'顾客下单':'顾客')+'（会员编号 '+who+'）':who}
export const withdrawalStatus=row=>row.status==='rejected'?'已驳回':({CREATED:'待审核',QUEUED:'已审核，等待转账',PROCESSING:'转账处理中',ACCEPTED:'微信已受理',TRANSFERING:'微信转账中',CANCELING:'正在取消转账',WAIT_USER_CONFIRM:'等待客户确认收款',SUCCESS:'已到账',FAIL:'转账失败',REJECTED:'已驳回',CANCELLED:'已关闭',UNKNOWN:'结果待核实'})[row.transfer_state]||({paid:'已到账',failed:'转账失败',unknown:'结果待核实',pending:'待处理'})[row.status]||row.transfer_note||'处理中'
export function stockMovement(row){
 const labels={migration:'初始入库',in:'入库',out:'出库',reserve:'订单占用',release:'释放占用',ship:'发货出库',transfer_in:'调拨入库',transfer_out:'调拨出库',reassign_in:'转入订单占用',reassign_out:'转出订单占用',adjust:'库存调整',return:'退回待验',return_pending:'退回待验',inspect:'验收入库',replacement:'换补发出库',writeoff:'报损',recover:'恢复可售',campaign_reserve:'活动占用',campaign_release:'释放活动占用'}
 const count=Number(row.quantity||0),minus=['out','ship','transfer_out','replacement','writeoff'].includes(row.kind)
 return {label:labels[row.kind]||row.kind||'库存变动',quantity:(minus?'-':count>0?'+':'')+(minus?Math.abs(count):count)}
}
export const netWithdrawal=row=>Number(row.amount||0)-Number(row.fee||0)-Number(row.tax_amount||0)-Number(row.service_fee||0)
export function monthDates(now=new Date()){const d=new Date(now.getTime()+8*3600000),today=d.toISOString().slice(0,10);return [today.slice(0,8)+'01',today]}
export function cashDateError(from,to){const read=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s?Date.parse(s+'T00:00:00Z'):NaN;try{const a=read(from),b=read(to);return !Number.isFinite(a)||!Number.isFinite(b)?'请选择有效日期':b<a?'结束日期不能早于开始日期':b-a>366*86400000?'最多查询367天':''}catch{return '请选择有效日期'}}

// 确认框里的金额（分 → ¥1,234.50）；这个文件不引用别的文件，自己格式化
const money=fen=>{const v=Math.round(Number(fen)||0),[whole,cents]=(Math.abs(v)/100).toFixed(2).split('.');return (v<0?'-':'')+'¥'+whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+cents}
const productTitle=row=>'「'+([row?.name,row?.spec].map(v=>String(v??'').trim()).filter(Boolean).join(' ')||'这件商品')+'」'
// 改价、上下架前的确认：写明是哪件商品、改了什么（原价 → 新价、上架/下架），手机上点快了也能看出来
export function productConfirm(row,body){
 const changes=[],text=v=>String(v??'').trim()
 if(body.name!==text(row?.name))changes.push('名称改为「'+body.name+'」')
 if(body.spec!==text(row?.spec))changes.push(body.spec?'规格改为「'+body.spec+'」':'去掉规格')
 if(Number(body.price)!==Number(row?.price))changes.push('零售价 '+money(row?.price)+' → '+money(body.price))
 if(body.enabled!==enabled(row?.enabled))changes.push(body.enabled?'上架':'下架')
 if(String(body.detail??'')!==String(row?.detail??''))changes.push('修改商品说明')
 return changes.length?'确认把'+productTitle(row)+changes.join('，')+'？':productTitle(row)+'没有改动，仍然保存？'
}
// 增减可售库存前的确认：哪件商品、哪个仓库和渠道、加还是减多少件
export function stockConfirm(row,delta){
 const n=Number(delta),where=[row?.warehouse_name,row?.channel==='B'?'采购':'零售'].filter(Boolean).join(' · ')
 return '确认给「'+([row?.product_name,row?.spec].filter(Boolean).join(' ')||'这件商品')+'」'+(where?'（'+where+'）':'')+(n>0?'增加 ':'减少 ')+Math.abs(n)+' 件可售库存？'+(Number.isFinite(Number(row?.available))&&row?.available!==undefined&&row?.available!==null?'现在可售 '+row.available+' 件。':'')
}
// 售后单是哪位顾客的：昵称（会员编号 N）
export const caseCustomer=row=>(String(row?.query_customer??'').trim()||'顾客')+'（会员编号 '+row?.member_id+'）'
// “待处理”只放要员工动手的单：已补发的在等顾客确认收到，没有可点的按钮
export const casePending=row=>!['rejected','refunded','completed','reshipped'].includes(row?.status)
// 提现是谁的：姓名（会员编号 N，手机尾号 NNNN）
export const withdrawalWho=row=>(row?.realName||row?.nickname||'推广员')+'（会员编号 '+row?.member_id+(row?.phoneTail?'，手机尾号 '+row.phoneTail:'')+'）'
