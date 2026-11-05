// 分销商 (phone). Pure rules only: no imports, no uni, no network, so node tests can load this file directly.
// Money is in fen, rates are parts of 10000 (3800 = 3.8折, 100 = 1%). Wording follows the PC 分销商与拿货 screens.
const halfWidth=v=>String(v??'').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/　/g,' ')
export function money(fen){const v=Number(fen);if(!Number.isFinite(v))return '¥0.00';const sign=v<0?'-':'',[w,c]=(Math.abs(Math.round(v))/100).toFixed(2).split('.');return sign+'¥'+w.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+c}
const readDay=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return NaN;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s?d.getTime():NaN}
// Integer hundredths of the typed number (yuan → fen, percent → parts of 10000), or null. Never goes through floating point.
const hundredths=text=>{const s=halfWidth(text).trim();if(!/^\d+(\.\d{1,2})?$/.test(s))return null;const [w,d='']=s.split('.'),n=Number(w)*100+Number(d.padEnd(2,'0'));return Number.isSafeInteger(n)?n:Infinity}

export const DISTRIBUTOR_FILTERS=[{key:'all',label:'全部'},{key:'buying',label:'能拿货'},{key:'promote',label:'只推广'},{key:'blocked',label:'已停用拿货'}]
export const FEE_METHODS=[['bank','银行转账'],['wechat','微信'],['alipay','支付宝'],['cash','现金'],['other','其他']]
export const TIER_MODES=[['auto','按加盟款自动定档'],['fixed','手动指定档位'],['blocked','停用拿货']]
export const PROOF_PATH=/^\/shop\/admin\/license\/[a-f0-9-]{36}\.png$/
export const FEE_REQUEST_KEY=/^[A-Za-z0-9_-]{8,80}$/
const TIER_NAMES=['第一档','第二档','第三档']
export const feeMethodName=v=>(FEE_METHODS.find(m=>m[0]===v)||[0,'其他'])[1]
export const discountText=rate=>{const n=Number(rate);return rate!==null&&rate!==''&&Number.isFinite(n)&&n>0&&n<10000?Number((n/1000).toFixed(2))+'折':''}
export const percentText=rate=>{const n=Number(rate);return rate===null||rate===undefined||rate===''||!Number.isFinite(n)?'':Number((n/100).toFixed(2))+'%'}
export const timeText=v=>v?String(v).replace('T',' ').slice(0,16):''
export function listQuery({q='',filter='all',page=1}={}){return 'q='+encodeURIComponent(halfWidth(q).trim())+'&filter='+(DISTRIBUTOR_FILTERS.some(f=>f.key===filter)?filter:'all')+'&page='+page}
// The server's list grammar and words (#会员号 / 11 位手机号 / 手机尾号 4 位 / 姓名或昵称至少 2 个字).
export function searchProblem(q){const raw=halfWidth(q).trim(),c=raw.replace(/[\s-]/g,'');if(!raw)return '';if(raw.length>40)return '搜索内容最多40个字';if(c[0]==='#')return /^#[1-9]\d{0,17}$/.test(c)?'':'会员编号请输入 # 加数字，例如 #123';if(/^\d{11}$/.test(c)||/^\d{4}$/.test(c))return '';if(/^\d+$/.test(c))return '请输入完整的11位手机号、手机号后4位，或在会员号前加 #（例如 #123）';if([...raw].length<2)return '昵称或姓名至少输入2个字';return ''}
export const displayName=r=>String(r?.realName||'').trim()||String(r?.nickname||'').trim()||'未填写姓名'
export const phoneText=r=>r?.phone?String(r.phone):r?.phoneTail?'手机尾号 '+r.phoneTail:'未留手机号'
export const memberLabel=r=>displayName(r)+'（'+['会员编号 '+r?.memberId,r?.phoneTail?'手机尾号 '+r.phoneTail:''].filter(Boolean).join('，')+'）'
export const applicationText=s=>({approved:'推广资格已通过',pending:'推广资格待审核',rejected:'推广资格未通过/已停用'})[s]||'未申请推广资格'
export const rowProfile=r=>({...r,name:r?.tierName||'',rate:r?.discountRate})
export function feeTierOf(total,thresholds){let t=0;(thresholds||[]).forEach((x,i)=>{if(Number(x)>0&&Number(total||0)>=Number(x))t=i+1});return t}

// What the person can buy at and why, in the PC's words. p = a list row through rowProfile, or the detail profile plus accountEnabled.
export function tierStatus(p,retail){
 p=p||{}
 const off=(source,next='')=>({canBuy:false,discount:'',source,next})
 // 还在待审核的写“推广资格待审核”（和详情页一致），不说成“未通过”
 if(p.applicationState!=='approved')return off(p.applicationState==='pending'?'推广资格待审核':'未通过分销审核')
 if(p.accountEnabled===false)return off('账号已停用')
 if(p.tierSource==='blocked')return off('已停用拿货','仍可推广，零售佣金按'+(retail?.source==='member'?'单独比例':'卖出奖励规则'))
 if(p.tierSource==='manual'){const auto=Number(p.automaticTier)||feeTierOf(p.feeTotal,p.thresholds);return {canBuy:!!p.enabled,discount:p.enabled?discountText(p.rate):'',source:'手动指定'+(p.name?' · '+p.name:''),next:auto>0?'按已登记加盟款应为 '+discountText(p.discountRates?.[auto-1]):'按已登记加盟款暂不能拿货'}}
 if(p.tierSource==='fee'&&p.enabled)return {canBuy:true,discount:discountText(p.rate),source:'按加盟款自动'+(p.name?' · '+p.name:''),next:p.remainingAmount!=null&&p.nextRate?'再登记 '+money(p.remainingAmount)+' 可升到 '+discountText(p.nextRate):'已是最高档'}
 const first=Number(p.thresholds?.[0]||0),r1=p.discountRates?.[0],fee=Number(p.feeTotal||0)
 return fee>0?off('加盟款未满第一档','再登记 '+money(first-fee)+' 可开通 '+discountText(r1)):off('未登记加盟款','登记满 '+money(first)+' 可开通 '+discountText(r1))
}
export const tierLadder=p=>(p?.tiers||[]).slice(0,3).map((t,i)=>TIER_NAMES[i]+' '+t.name+'：加盟款满 '+money(t.referenceAmount)+'，'+discountText(t.rate))
export function commissionText(v){
 const s=v?.source,has=v?.rate!==null&&v?.rate!==undefined
 if(s==='member'&&has)return '零售佣金 '+percentText(v.rate)+'（单独比例，优先）'
 if(s==='partner_tier'&&has)return '零售佣金 '+percentText(v.rate)+'（按拿货档位）'
 if(s==='rule')return '零售佣金按卖出奖励规则'+(has?'（'+percentText(v.rate)+'）':'')
 if(s==='none')return '暂无零售佣金（推广资格或账号已停用）'
 return ''
}
export function afterRemoveText(v){
 if(v?.source==='partner_tier')return '按拿货档位 '+percentText(v.rate)
 if(v?.source==='rule')return '按卖出奖励规则'+(v.rate!==null&&v.rate!==undefined?' '+percentText(v.rate):'')
 return '暂无（推广资格或账号已停用）'
}

export function bigYuanToFen(v){const s=halfWidth(v).trim();if(!s)throw Error('请填写收款金额');const fen=hundredths(s);if(fen===null)throw Error('请填写正确的金额，最多保留两位小数');if(fen<1||fen>100000000000)throw Error('金额应在0.01至1,000,000,000元之间');return fen}
// One key per opened form; every resend of that form uses the same key so the server never counts it twice.
export function newFeeRequestKey(now=Date.now(),random=Math.random){return 'mfee_'+now.toString(36)+'_'+random().toString(36).slice(2,12).padEnd(6,'0')}
export function readFeeForm(e,now=Date.now()){
 let amount
 try{amount=bigYuanToFen(e?.amount)}catch(x){return {error:x.message}}
 if(!FEE_METHODS.some(m=>m[0]===e.method))return {error:'请选择收款方式'}
 const date=String(e.date||''),time=String(e.time||'')
 if(!Number.isFinite(readDay(date))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return {error:'请选择收款时间'}
 if(Number(date.slice(0,4))<2020)return {error:'收款时间不能早于2020年'}
 if(Date.parse(date+'T'+time+':00+08:00')>now+600000)return {error:'收款时间不能晚于现在'}
 const referenceNo=halfWidth(e.referenceNo).trim(),note=String(e.note??'').trim(),proofUrl=String(e.proofUrl||'')
 if(referenceNo.length>80)return {error:'凭证号不超过80字'}
 if(note.length>300)return {error:'备注不超过300字'}
 if(proofUrl&&!PROOF_PATH.test(proofUrl))return {error:'凭证图片无效，请重新上传'}
 if(!FEE_REQUEST_KEY.test(String(e.requestKey||'')))return {error:'请重新打开登记窗口后再提交'}
 // 第一次提交就带 confirmSharedReference:false：告诉服务器这个页面会弹“同一笔转账”确认框（旧版小程序不带，服务器对它直接拦下）
 return {body:{amount,method:e.method,paidAt:date+' '+time,referenceNo,note,proofUrl,requestKey:e.requestKey,confirmSharedReference:false}}
}
export function feePreview(p,addFen){
 const total=Number(p?.feeTotal||0)+Math.max(0,Number(addFen)||0)
 if(p?.applicationState!=='approved')return '推广资格审核通过后，才按加盟款定拿货档位。登记后累计 '+money(total)+'。'
 if(p.mode==='blocked')return '这位分销商已停用拿货，登记后累计 '+money(total)+'，仍不能拿货。'
 if(p.mode==='fixed')return '这位分销商是手动指定档位，登记后累计 '+money(total)+'，折扣不变。'
 const t=feeTierOf(total,p.thresholds)
 return '登记后累计 '+money(total)+(t?'，按加盟款可享 '+discountText(p.discountRates?.[t-1]):'，还没满第一档，暂不能拿货')+'。'
}
const beijingTime=v=>{const s=String(v||'').trim().replace(' ','T');return Date.parse(s+(s.length===16?':00':'')+'+08:00')}
export function recentDuplicate(records,amountFen,now=Date.now()){
 const amount=Number(amountFen)
 if(!(amount>0))return ''
 const r=(Array.isArray(records)?records:[]).find(x=>x?.state==='valid'&&Number(x.amount)===amount&&now-beijingTime(x.createdAt)<=600000)
 return r?'10 分钟内已登记过一笔 '+money(r.amount)+'（'+(r.createdBy||'同事')+'），请确认不是重复登记。':''
}
export const reasonProblem=(text,label)=>{const n=String(text??'').trim().length;return n<2||n>300?'请填写2至300字'+label:''}
export function readVoidForm(e){const p=reasonProblem(e?.reason,'作废原因');return p?{error:p}:{body:{reason:String(e.reason).trim()}}}
export function readTierChoice(p,e){
 const mode=e?.mode,tier=Number(e?.tier)
 if(!TIER_MODES.some(m=>m[0]===mode))return {error:'请选择按加盟款自动定档、手动指定档位或停用拿货'}
 if(mode!=='blocked'&&p?.applicationState!=='approved')return {error:'请先由用户申请分销商并审核通过，再设置拿货档位'}
 if(mode==='fixed'&&!(Number.isInteger(tier)&&tier>=1&&tier<=3))return {error:'请选择第1至第3档'}
 if(mode===(p?.mode||'auto')&&(mode!=='fixed'||tier===Number(p?.tier)))return {error:'和现在的设置一样，不用保存'}
 return {body:mode==='fixed'?{mode,tier}:{mode}}
}
export function tierChoiceText(p,mode,tier){
 const label=t=>TIER_NAMES[t-1]+(p?.tiers?.[t-1]?.name?' '+p.tiers[t-1].name:'')
 if(mode==='blocked')return '停用拿货（仍可推广）'
 if(mode==='fixed')return tier>=1&&tier<=3?'手动指定 · '+label(tier)+'（'+discountText(p?.discountRates?.[tier-1])+'）':'手动指定（暂不能拿货）'
 const a=feeTierOf(p?.feeTotal,p?.thresholds)
 return '按加盟款自动定档（'+(a?label(a)+' '+discountText(p?.discountRates?.[a-1]):'加盟款未满第一档，暂不能拿货')+'）'
}
export const currentTierText=p=>tierChoiceText(p,p?.mode||'auto',Number(p?.tier)||0)
export function isDowngrade(p,mode,tier){
 const now=p?.enabled?Number(p.rate)||0:0,a=feeTierOf(p?.feeTotal,p?.thresholds)
 const next=mode==='blocked'?0:mode==='fixed'?Number(p?.discountRates?.[tier-1])||0:a?Number(p?.discountRates?.[a-1])||0:0
 return now>0&&(next===0||next>now)
}
export const rateToPercentInput=rate=>String(Number((Number(rate)/100).toFixed(2)))
export function percentToRate(text){const rate=hundredths(text);if(rate===null)throw Error('比例请填数字，最多保留两位小数');if(rate>9000)throw Error('单独比例须为0%至90%');return rate}
export function readCommissionForm(e){
 if(e?.action==='remove'){const p=reasonProblem(e.reason,'调整原因');return p?{error:p}:{body:{action:'remove',reason:String(e.reason).trim()}}}
 let rate
 try{rate=percentToRate(e?.percent)}catch(x){return {error:x.message}}
 const p=reasonProblem(e.reason,'调整原因')
 return p?{error:p}:{body:{action:'set',rate,reason:String(e.reason).trim()}}
}

export const feeConfirmText=(m,b)=>'给'+memberLabel(m)+'登记加盟款 '+money(b.amount)+'，收款方式：'+feeMethodName(b.method)+'，收款时间：'+b.paidAt+'。登记后按加盟款重新确定拿货档位，确认登记？'
export const feeRetryConfirmText=b=>'再次提交同一笔登记（'+money(b.amount)+'）？如果上次已经登记成功，这次不会重复计入。'
export function voidConfirmText(m,f,p){const after=Math.max(0,Number(p?.feeTotal||0)-(f.state==='valid'?Number(f.amount):0));return '作废'+memberLabel(m)+' '+timeText(f.paidAt)+' 收到的加盟款 '+money(f.amount)+'？作废后累计加盟款变为 '+money(after)+'，拿货档位可能下降，未付款的拿货单会被取消。作废后不能恢复。'}
export const tierConfirmText=(m,p,b)=>'把'+memberLabel(m)+'的拿货方式从「'+currentTierText(p)+'」改为「'+tierChoiceText(p,b.mode,b.tier)+'」？'+(isDowngrade(p,b.mode,b.tier)?'档位下降或停用后，未付款的拿货单会被自动取消。':'')
export function commissionConfirmText(m,b,d){
 if(b.action==='remove')return '取消'+memberLabel(m)+'的单独比例 '+percentText(d?.commission?.single?.rate)+'？取消后零售佣金'+afterRemoveText(d?.commission?.afterRemove)+'，只对之后的新订单生效。'
 return '把'+memberLabel(m)+'的零售佣金单独比例设为 '+percentText(b.rate)+'？只对之后的新订单生效。'
}
export const DISTRIBUTOR_UNCERTAIN={
 fee:'网络不稳定，暂时不能确认是否已登记。内容已锁定，可以原样再提交一次（不会重复计入），也可以返回详情核对加盟款记录。',
 void:'网络不稳定，暂时不能确认是否已作废。请返回详情查看这笔记录的状态，已作废的不用再操作。',
 tier:'网络不稳定，暂时不能确认是否已调整。请返回详情查看现在的拿货方式，和你要的一致就不用再操作。',
 commission:'网络不稳定，暂时不能确认是否已保存。请返回详情查看现在的零售佣金比例，和你要的一致就不用再操作。'
}
export const DISTRIBUTOR_DONE={fee:'已登记',void:'已作废',tier:'已调整',commission:'已保存'}
