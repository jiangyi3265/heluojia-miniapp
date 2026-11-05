// 客户档案 (phone). Pure rules only: no imports, no uni, no network, so node tests can load this file directly.
// Money is in fen. 门店余额 is the shop's own balance account that 店长/财务 top up at the counter (one person registers,
// it is credited at once); it pays for 拿货 and 零售 orders. 小程序充值余额 is the WeChat recharge and only pays 零售.
const halfWidth=v=>String(v??'').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/　/g,' ')
export function money(fen){const v=Number(fen);if(!Number.isFinite(v))return '¥0.00';const sign=v<0?'-':'',[w,c]=(Math.abs(Math.round(v))/100).toFixed(2).split('.');return sign+'¥'+w.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+c}
// Integer hundredths of the typed number (yuan → fen), or null. Never goes through floating point.
const hundredths=text=>{const s=halfWidth(text).trim();if(!/^\d+(\.\d{1,2})?$/.test(s))return null;const [w,d='']=s.split('.'),n=Number(w)*100+Number(d.padEnd(2,'0'));return Number.isSafeInteger(n)?n:Infinity}

export const CUSTOMER_FILTERS=[{key:'all',label:'全部'},{key:'retail',label:'C端顾客'},{key:'buying',label:'B端拿货'},{key:'balance',label:'有门店余额',money:true}]
export const CUSTOMER_SORTS=[{key:'recent',label:'最近消费'},{key:'newest',label:'新注册'},{key:'balance',label:'门店余额多',money:true}]
// 按余额筛选、排序只给能看客户的钱的人（店长、财务），与服务器同一条件
export const filtersFor=me=>CUSTOMER_FILTERS.filter(f=>!f.money||me?.canViewMoney===true)
export const sortsFor=me=>CUSTOMER_SORTS.filter(s=>!s.money||me?.canViewMoney===true)
export function listQuery({q='',filter='all',sort='recent',page=1}={}){
 return 'q='+encodeURIComponent(halfWidth(q).trim())+'&filter='+(CUSTOMER_FILTERS.some(f=>f.key===filter)?filter:'all')+'&sort='+(CUSTOMER_SORTS.some(s=>s.key===sort)?sort:'recent')+'&page='+page
}
// The server's search grammar and words (#会员号 / 11 位手机号 / 手机尾号 4 位 / 姓名或昵称至少 2 个字): a search it would refuse is never sent.
export function searchProblem(q){
 const raw=halfWidth(q).trim(),c=raw.replace(/[\s-]/g,'')
 if(!raw)return ''
 if(raw.length>40)return '搜索内容最多40个字'
 if(c[0]==='#')return /^#[1-9]\d{0,17}$/.test(c)?'':'会员编号请输入 # 加数字，例如 #123'
 if(/^\d{11}$/.test(c)||/^\d{4}$/.test(c))return ''
 if(/^\d+$/.test(c))return '请输入完整的11位手机号、手机号后4位，或在会员号前加 #（例如 #123）'
 if([...raw].length<2)return '昵称或姓名至少输入2个字'
 return ''
}

export const displayName=r=>String(r?.realName||'').trim()||String(r?.nickname||'').trim()||'商城顾客'
export const segmentText=r=>r?.segment==='buying'?'B端拿货':'C端顾客'
export const identityLine=r=>{const t=(Array.isArray(r?.identities)?r.identities:[]).filter(x=>typeof x==='string'&&x.trim());return t.length?t.join(' · '):'顾客'}
export const phoneLine=r=>r?.phone?String(r.phone):'未留手机号'
// Only a full mainland mobile number can be dialled; a masked one (138****1234) cannot.
export const callablePhone=p=>/^1\d{10}$/.test(String(p||''))
export const timeText=v=>v?String(v).replace('T',' ').slice(0,16):''
export const lastPaidText=r=>r?.lastPaidAt?'最近消费 '+timeText(r.lastPaidAt)+'（共 '+(Number(r.paidOrders)||0)+' 单）':'还没有付款的订单'
export const rowMoneyText=r=>'门店余额 '+money(r?.storeBalance)+(Number(r?.onlineBalance)>0?' · 小程序充值余额 '+money(r.onlineBalance):'')
// 客户的余额：门店余额（店里充值，拿货和零售都能用）和小程序充值余额（微信充值，只能零售）分开写；
// 待付款订单占用的钱下单时已经扣出，不在余额里，所以写“另有…”，不能写成“其中…”。
export function balanceLines(w){
 const fen=v=>Number(v)||0,legacy=w?.legacy||{},online=w?.online||{}
 const lines=[{key:'store',label:'门店余额（拿货、零售都能用）',value:fen(legacy.available)}]
 if(fen(legacy.reserved)>0)lines.push({key:'storeReserved',label:'另有门店余额被待付款订单占用',value:fen(legacy.reserved)})
 lines.push({key:'online',label:'小程序充值余额（只能零售）',value:fen(online.available)})
 if(fen(online.reserved)>0)lines.push({key:'onlineReserved',label:'另有小程序余额被待付款订单占用',value:fen(online.reserved)})
 if(fen(w?.refundFrozen)>0)lines.push({key:'refundFrozen',label:'充值退款处理中',value:fen(w.refundFrozen)})
 return lines
}

export const TOPUP_METHODS=[{key:'cash',label:'现金'},{key:'bank',label:'对公转账',referenceRequired:true},{key:'wechat',label:'微信转账'},{key:'alipay',label:'支付宝转账'},{key:'other',label:'其他'}]
// 服务器给的收款方式优先（名称、顺序以服务器为准）；还没更新的服务器没给时用这一份
export const methodsOf=d=>Array.isArray(d?.methods)&&d.methods.length?d.methods:TOPUP_METHODS
export const methodName=(key,methods=TOPUP_METHODS)=>(methods.find(m=>m.key===key)||{label:'其他'}).label
export function topupYuanToFen(v){
 const s=halfWidth(v).trim();if(!s)throw Error('请填写充值金额')
 const fen=hundredths(s);if(fen===null)throw Error('请填写正确的金额，最多保留两位小数')
 if(fen<1||fen>100000000)throw Error('充值金额要在 0.01 元到 100 万元之间')
 return fen
}
export const TOPUP_REQUEST_KEY=/^[A-Za-z0-9_-]{8,80}$/
// One key per opened form; every resend of that form uses the same key so the server never credits it twice.
export function newTopupRequestKey(now=Date.now(),random=Math.random){return 'mtop_'+now.toString(36)+'_'+random().toString(36).slice(2,12).padEnd(6,'0')}
export function readTopupForm(e,methods=TOPUP_METHODS){
 let amount
 try{amount=topupYuanToFen(e?.amount)}catch(x){return {error:x.message}}
 const method=e?.method
 if(!methods.some(m=>m.key===method))return {error:'请选择收款方式'}
 let reference=halfWidth(e?.reference).trim()
 if(reference.length>120)return {error:'流水号或收款说明最多120个字'}
 if(method==='bank'){reference=reference.replace(/\s/g,'');if(reference.length<4)return {error:'对公转账请填写银行流水号'}}
 const note=String(e?.note??'').trim()
 if(note.length>300)return {error:'备注最多300个字'}
 if(!TOPUP_REQUEST_KEY.test(String(e?.requestKey||'')))return {error:'请重新打开充值窗口后再提交'}
 // 第一次提交就带 confirmSharedReference:false：告诉服务器这个页面会弹“同一笔转账”确认框（旧版小程序不带，服务器对它直接拦下）
 return {body:{amount,method,reference,note,requestKey:e.requestKey,confirmSharedReference:false}}
}
export const memberLabel=m=>displayName(m)+'（会员编号 '+m?.memberId+(m?.phone?'，'+m.phone:'')+'）'
export const topupConfirmText=(m,b,methods=TOPUP_METHODS)=>'给'+memberLabel(m)+'充值 '+money(b.amount)+'，收款方式：'+methodName(b.method,methods)+(b.reference?'（'+b.reference+'）':'')+'。确认钱已经收到：登记后立即记入客户的门店余额，客户下单时打开「使用门店余额」就能用，拿货和零售都能用。'
export const topupRetryConfirmText=b=>'再次提交同一笔充值（'+money(b.amount)+'）？如果上次已经登记成功，这次不会重复到账。'
export const voidConfirmText=(m,t)=>'作废'+memberLabel(m)+' '+timeText(t?.createdAt)+' 登记的门店充值 '+money(t?.amount)+'？作废后从客户的门店余额扣回 '+money(t?.amount)+'，不能恢复。'
export const reasonProblem=(text,label)=>{const n=String(text??'').trim().length;return n<2||n>300?'请填写2至300字'+label:''}
export function readVoidForm(e){const p=reasonProblem(e?.reason,'作废原因');return p?{error:p}:{body:{reason:String(e.reason).trim()}}}
const beijingTime=v=>{const s=String(v||'').trim().replace(' ','T');return Date.parse(s+(s.length===16?':00':'')+'+08:00')}
// 10 分钟内这位客户已有一笔同样金额的有效充值：提醒可能是重复登记（不拦，由员工自己核对）。
export function recentDuplicate(records,amountFen,now=Date.now()){
 const amount=Number(amountFen)
 if(!(amount>0))return ''
 const r=(Array.isArray(records)?records:[]).find(x=>x?.state==='valid'&&Number(x.amount)===amount&&now-beijingTime(x.createdAt)<=600000)
 return r?'10 分钟内已给这位客户登记过一笔 '+money(r.amount)+'，登记人 '+(r.createdBy||'同事')+'，请确认不是重复登记。':''
}
// 10 分钟内已给这位客户退过一笔同样金额的门店余额：提醒可能是重复退款（不拦，由店长自己核对；退款不能撤销。第 16 批补缺口 C16）
export function recentRefundDuplicate(records,amountFen,now=Date.now()){
 const amount=Number(amountFen)
 if(!(amount>0))return ''
 const r=(Array.isArray(records)?records:[]).find(x=>Number(x?.amount)===amount&&now-beijingTime(x?.createdAt)<=600000)
 return r?'10 分钟内已给这位客户退过一笔 '+money(r.amount)+'，登记人 '+(r.createdBy||'同事')+'，请确认不是重复退款。':''
}
// 充值后门店余额大约多少（按现在读到的余额加这一笔；同一时间顾客下单用掉的不算）
export const afterTopupText=(w,addFen)=>'充值后门店余额约 '+money((Number(w?.legacy?.available)||0)+Math.max(0,Number(addFen)||0))
// 门店余额退款（店长，店主 10-05）：最多退客户现在能用的门店余额（被待付款订单占用的不能退）
export function newRefundRequestKey(now=Date.now(),random=Math.random){return 'mref_'+now.toString(36)+'_'+random().toString(36).slice(2,12).padEnd(6,'0')}
export function readRefundForm(e,methods=TOPUP_METHODS,availableFen=Infinity){
 const s=halfWidth(e?.amount).trim();if(!s)return {error:'请填写退款金额'}
 const amount=hundredths(s);if(amount===null)return {error:'请填写正确的金额，最多保留两位小数'}
 if(amount<1||amount>100000000)return {error:'退款金额要在 0.01 元到 100 万元之间'}
 const max=Number(availableFen);if(Number.isFinite(max)&&amount>max)return {error:'最多能退 '+money(max)+'（被待付款订单占用的不能退）'}
 const method=e?.method;if(!methods.some(m=>m.key===method))return {error:'请选择退款方式'}
 let reference=halfWidth(e?.reference).trim();if(reference.length>120)return {error:'流水号或退款说明最多120个字'}
 if(method==='bank'){reference=reference.replace(/\s/g,'');if(reference.length<4)return {error:'对公转账退款请填写银行流水号'}}
 const reason=String(e?.reason??'').trim();if(reason.length<2||reason.length>300)return {error:'请填写2至300字退款原因'}
 if(!TOPUP_REQUEST_KEY.test(String(e?.requestKey||'')))return {error:'请重新打开退款窗口后再提交'}
 return {body:{amount,method,reference,reason,requestKey:e.requestKey}}
}
export const refundConfirmText=(m,b,methods=TOPUP_METHODS)=>'给'+memberLabel(m)+'退门店余额 '+money(b.amount)+'，退款方式：'+methodName(b.method,methods)+(b.reference?'（'+b.reference+'）':'')+'。确认钱已经退给客户：登记后客户的门店余额减少 '+money(b.amount)+'，不能撤销。'
export const refundRetryConfirmText=b=>'再次提交同一笔退款（'+money(b.amount)+'）？如果上次已经登记成功，这次不会重复退款。'
export const topupStateText=t=>t?.state==='void'?'已作废':'已到账'
export const STORE_BALANCE_OFF='经营设置里的「余额付款」现在是关闭的：充值照常记入门店余额，但客户下单时暂时用不了。请店长在电脑后台「经营设置 → 付款方式」打开。'
export const CUSTOMER_UNCERTAIN={
 topup:'网络不稳定，暂时不能确认是否已充值。内容已锁定，可以原样再提交一次（不会重复到账），也可以返回档案核对充值记录。',
 void:'网络不稳定，暂时不能确认是否已作废。请返回档案查看这笔充值的状态，已作废的不用再操作。',
 refund:'网络不稳定，暂时不能确认是否已退款。内容已锁定，可以原样再提交一次（不会重复退款），也可以返回档案核对退款记录。'
}
export const CUSTOMER_DONE={topup:'已充值，已记入门店余额',void:'已作废，已从门店余额扣回',refund:'已退款，门店余额已扣回'}
