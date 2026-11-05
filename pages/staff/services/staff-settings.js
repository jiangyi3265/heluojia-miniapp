// 经营设置 (phone). Pure rules only: no imports, no uni, no network, so node tests can load this file directly.
// Money is in fen, rates are parts of 10000. Checks and words follow the PC 经营设置 / 平台费用 / 配送 screens and the server.
const halfWidth=v=>String(v??'').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/　/g,' ')
export function money(fen){const v=Number(fen);if(!Number.isFinite(v))return '¥0.00';const sign=v<0?'-':'',[w,c]=(Math.abs(Math.round(v))/100).toFixed(2).split('.');return sign+'¥'+w.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+c}
// Integer hundredths of the typed number (yuan → fen, percent → parts of 10000), or null. Never goes through floating point.
const hundredths=text=>{const s=halfWidth(text).trim();if(!/^\d+(\.\d{1,2})?$/.test(s))return null;const [w,d='']=s.split('.'),n=Number(w)*100+Number(d.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null}

export const WITHDRAWAL_FIELDS=[['withdrawMinimum','最低提现金额','money'],['withdrawFee','每笔提现手续费','money'],['withdrawTaxRate','提现代扣比例','rate'],['withdrawWorkingDays','处理时限','days'],['withdrawMaxAmount','单笔提现最多到账','money']]
export const percentText=rate=>Number((Math.max(0,Number(rate)||0)/100).toFixed(2))+'%'
export const valueText=(kind,v)=>kind==='money'?money(v):kind==='rate'?(Number(v)>0?percentText(v):'不代扣'):v===undefined||v===null||v===''?'未设置':v+' 个工作日'
export const yuanInput=fen=>(Math.max(0,Math.round(Number(fen)||0))/100).toFixed(2)
export const rateToPercentInput=rate=>String(Number((Math.max(0,Number(rate)||0)/100).toFixed(2)))
export const withdrawalForm=w=>({withdrawMinimum:yuanInput(w.withdrawMinimum),withdrawFee:yuanInput(w.withdrawFee),withdrawTaxRate:rateToPercentInput(w.withdrawTaxRate),withdrawWorkingDays:String(w.withdrawWorkingDays??3),withdrawMaxAmount:yuanInput(w.withdrawMaxAmount)})
export function readYuan(text,min,max){const fen=hundredths(text);if(fen===null)return {bad:'format'};return fen<min||fen>max?{bad:'range'}:{fen}}
export function readPercent(text,maxPercent){const rate=hundredths(text);return rate!==null&&rate<=maxPercent*100?rate:null}

export const WITHDRAW_MAX_NOTE='推广员一次提现最多能到微信零钱的金额，按扣完手续费、代扣税费和平台服务费之后的实际到账算。不能高于微信支付商户平台「商家转账」的单笔额度（默认 200 元，提高要先向微信申请），否则超出的提现会被微信拒绝。可填 0.10 元到 1999.99 元。'
export const TAX_NOTE='按推广员的提现申请金额（税前）代扣，向下取整到分；申请时锁定比例，只影响之后的新申请；代扣的钱由公司代为申报缴纳，比例请与会计确认。填 0 表示不代扣，最高 50%。'
export const DAYS_NOTE='1 到 30 个工作日，按周一至周五计算。'
export const SERVICE_NOTE='分销商提现时从提现金额里扣，向下取整到分；比例在申请提现时锁定，只影响之后的新申请。其它平台费用在电脑后台「平台费用与结算」修改。'
export const SETTINGS_UNCERTAIN='网络不稳定，暂时不能确认是否已保存。请返回查看现在的设置，和你要的一致就不用再改。'
export const STALE_SETTINGS=/刚被别人改过|请刷新/
const MAX_WORDS='单笔提现最多到账要在 0.10 元到 1999.99 元之间（2000 元及以上微信要求核验收款人实名，本系统暂不支持）'

// base = the withdrawal values exactly as loaded. Returns {values} (all 5 keys, integers) or {error}.
export function readWithdrawalForm(form,base){
 const b=base||{},min=readYuan(form.withdrawMinimum,0,100000000)
 if(min.bad)return {error:'最低提现金额应在0至1,000,000元之间，填0表示不设门槛，最多两位小数'}
 const fee=readYuan(form.withdrawFee,0,100000000)
 if(fee.bad)return {error:'每笔提现手续费应在0至1,000,000元之间，最多两位小数'}
 if(min.fen>0&&min.fen<=fee.fen)return {error:'最低提现金额必须大于手续费'}
 const tax=readPercent(form.withdrawTaxRate,50)
 if(tax===null)return {error:'提现代扣比例为0%至50%，最多两位小数'}
 const daysText=halfWidth(form.withdrawWorkingDays).trim(),days=Number(daysText)
 if(!/^\d+$/.test(daysText)||days<1||days>30)return {error:'提现处理时限为1至30个工作日'}
 const max=readYuan(form.withdrawMaxAmount,0,Number.MAX_SAFE_INTEGER)
 if(max.bad)return {error:MAX_WORDS}
 const maxChanged=max.fen!==Number(b.withdrawMaxAmount),minChanged=min.fen!==Number(b.withdrawMinimum)
 if(maxChanged&&(max.fen<10||max.fen>199999))return {error:MAX_WORDS}
 if((maxChanged||minChanged)&&max.fen<min.fen)return {error:'单笔提现最多到账（'+money(max.fen)+'）不能低于最低提现金额（'+money(min.fen)+'），否则推广员无法提现'}
 const values={withdrawMinimum:min.fen,withdrawFee:fee.fen,withdrawTaxRate:tax,withdrawWorkingDays:days,withdrawMaxAmount:max.fen}
 if(WITHDRAWAL_FIELDS.every(([k])=>values[k]===Number(b[k])))return {error:'没有修改任何内容'}
 return {values}
}
export function withdrawalNotice(w){const max=Number(w?.withdrawMaxAmount),min=Number(w?.withdrawMinimum);return Number.isFinite(max)&&Number.isFinite(min)&&max<min?'现在的单笔提现最多到账 '+money(max)+' 低于最低提现金额 '+money(min)+'，推广员可能无法提现，建议调高单笔提现最多到账或调低最低提现金额。':''}
export function withdrawalExampleText(w,serviceRate){
 const minimum=Number(w?.withdrawMinimum)||0,a=minimum>0?minimum:100,fee=Number(w?.withdrawFee)||0,tax=Math.floor(a*(Number(w?.withdrawTaxRate)||0)/10000),svc=Math.floor(a*(Number(serviceRate)||0)/10000),net=a-fee-tax-svc
 return (minimum===0?'不设提现门槛，扣费后到账至少 ¥0.10。':'')+'举例：推广员申请 '+money(a)+(minimum>0?'（最低提现金额）':'')+'时，代扣税费 '+money(tax)+'，平台服务费 '+money(svc)+'，手续费 '+money(fee)+'，实际到账 '+money(Math.max(0,net))+'。'+(net<10?'实际到账不足 ¥0.10，微信不能转账，建议调整。':'')
}
// Live example while typing: range and change checks are ignored, but an unreadable field shows nothing.
export function withdrawalFormExample(form,serviceRate){
 const a=hundredths(form?.withdrawMinimum),fee=hundredths(form?.withdrawFee),tax=hundredths(form?.withdrawTaxRate)
 return a===null||fee===null||tax===null?'':withdrawalExampleText({withdrawMinimum:a,withdrawFee:fee,withdrawTaxRate:tax},serviceRate)
}
export function withdrawalConfirmText(base,values){
 const b=base||{},changed=k=>Number(b[k])!==Number(values[k])
 let text=WITHDRAWAL_FIELDS.filter(([k])=>changed(k)).map(([k,label,kind])=>label+'：'+valueText(kind,b[k])+' → '+valueText(kind,values[k])).join('\n')
 if(changed('withdrawTaxRate'))text+='\n代扣比例只影响之后的新申请。'
 if(changed('withdrawMaxAmount')){const before=Number(b.withdrawMaxAmount),after=Number(values.withdrawMaxAmount);text+='\n'+(after>before?'调高后请先确认微信支付商户平台「商家转账」里的单笔额度不低于 '+money(after)+'，否则超出的提现会被微信拒绝。':'调低后，已提交但到账超过 '+money(after)+' 的申请不能审核通过，需要拒绝后让推广员分开重新申请。')}
 return text+'\n确认保存？'
}
export function readServiceRate(text,base){
 const rate=readPercent(text,50)
 if(rate===null)return {error:'分销商平台服务费比例须在0%至50%之间，最多两位小数'}
 if(rate===Number(base?.distributorServiceRate))return {error:'没有修改任何内容'}
 return {values:{distributorServiceRate:rate}}
}
export const serviceConfirmText=(base,v)=>'分销商平台服务费：'+percentText(base?.distributorServiceRate)+' → '+percentText(v.distributorServiceRate)+'\n只影响之后新提交的提现申请。举例：提现 ¥100.00 扣 '+money(Math.floor(10000*Number(v.distributorServiceRate)/10000))+'。\n确认保存？'

// Delivery: the phone edits the four fee amounts of existing rules, the method switches and the pickup stores.
// Regions, piece counts and the notice stay as stored; the server merges the patch into the full settings.
export const DELIVERY_METHODS=[['express','快递配送'],['freight','物流配送'],['local','同城配送'],['pickup','门店自提']]
export const methodLabel=k=>(DELIVERY_METHODS.find(m=>m[0]===k)||[0,'其他配送方式'])[1]
export const ruleTitle=r=>(r?.methodLabel||methodLabel(r?.method||'express'))+' · '+(String(r?.regionsText||'').trim()||'未填写地区')
export const ruleFeeText=r=>'首 '+r.first+' 件 '+money(r.firstFee)+'，每续 '+r.next+' 件加 '+money(r.nextFee)+(Number(r.remoteFee)>0?'，偏远附加 '+money(r.remoteFee):'')+'；'+(Number(r.freeAmount)>0?'满 '+money(r.freeAmount)+' 包邮':'不包邮')
export const pointWarehouseText=p=>p?.warehouseEnabled?(String(p.warehouseName||'').trim()||'未知仓库'):(p?.warehouseName?p.warehouseName+'（已停用，请修改）':'原仓库已停用，请修改')
export function newPointKey(now=Date.now(),random=Math.random){return 'new_'+now+'_'+random().toString(36).slice(2,8).padEnd(6,'0')}
export function deliveryForm(d){return {methods:Object.fromEntries(DELIVERY_METHODS.map(([k])=>[k,(d.methods||[]).includes(k)])),rules:(d.rules||[]).map(r=>({index:r.index,title:ruleTitle(r),first:r.first,next:r.next,firstFee:yuanInput(r.firstFee),nextFee:yuanInput(r.nextFee),remoteFee:yuanInput(r.remoteFee),freeAmount:yuanInput(r.freeAmount)})),points:(d.points||[]).map(p=>({key:p.id,id:p.id,name:p.name||'',address:p.address||'',hours:p.hours||'',warehouseId:p.warehouseEnabled?p.warehouseId:null,pendingPickups:Number(p.pendingPickups)||0}))}}
const FEE_KEYS=['firstFee','nextFee','remoteFee','freeAmount']
const FEE_LABELS={firstFee:'首件运费',nextFee:'续件运费',remoteFee:'偏远附加费',freeAmount:'满额包邮金额'}
export function readDeliveryForm(form,base,warehouses){
 const b=base||{},methods=DELIVERY_METHODS.map(([k])=>k).filter(k=>form.methods?.[k]===true)
 if(!methods.length)return {error:'请至少开启一种配送方式'}
 const rules=[]
 for(const r of form.rules||[]){
  const out={index:r.index}
  for(const k of FEE_KEYS){const v=readYuan(r[k],0,100000000);if(v.bad)return {error:'「'+r.title+'」的'+FEE_LABELS[k]+'应在0至1,000,000元之间，最多两位小数'};out[k]=v.fen}
  rules.push(out)
 }
 for(const m of methods)if(m!=='pickup'&&!(b.rules||[]).some(r=>(r.method||'express')===m))return {error:'开启“'+methodLabel(m)+'”前，请先在电脑后台为它设置运费规则，或在这里关闭“'+methodLabel(m)+'”'}
 const list=form.points||[]
 if(list.length>100)return {error:'门店最多100个'}
 if(methods.includes('pickup')&&!list.length)return {error:'开启门店自提前请至少保留一个门店'}
 const points=[]
 for(const f of list){
  const name=String(f.name??'').trim(),label=name||'新门店',address=String(f.address??'').trim(),hours=String(f.hours??'').trim()
  if(name.length<1||name.length>80)return {error:'请填写门店名称（最多80字）'}
  if(address.length<5||address.length>400)return {error:'门店“'+label+'”的详细地址请填写5至400字'}
  if(hours.length>80)return {error:'门店“'+label+'”的营业时间最多80字'}
  if(f.warehouseId===null||f.warehouseId===undefined||f.warehouseId==='')return {error:'请为门店“'+label+'”选择备货仓库'}
  if(!(warehouses||[]).some(w=>Number(w.id)===Number(f.warehouseId)))return {error:'门店“'+label+'”对应的仓库已停用或不存在，请重新选择'}
  points.push({id:f.id||'',name,address,hours,warehouseId:Number(f.warehouseId)})
 }
 const values={methods,rules,points}
 if(!deliveryChangeLines(b,values,warehouses).length)return {error:'没有修改任何内容'}
 return {values}
}
export function deliveryChangeLines(base,values,warehouses){
 const b=base||{},lines=[],before=b.methods||[],after=values.methods||[],labels=list=>list.map(methodLabel).join('、')
 const on=after.filter(k=>!before.includes(k)),off=before.filter(k=>!after.includes(k))
 if(on.length)lines.push('开启：'+labels(on))
 if(off.length)lines.push('关闭：'+labels(off))
 const fmt=(k,v)=>k==='freeAmount'&&!(Number(v)>0)?'不包邮':money(v)
 for(const r of values.rules||[]){const old=(b.rules||[]).find(x=>x.index===r.index);if(!old)continue;for(const k of FEE_KEYS)if(Number(old[k])!==Number(r[k]))lines.push('「'+ruleTitle(old)+'」'+FEE_LABELS[k]+'：'+fmt(k,old[k])+' → '+fmt(k,r[k]))}
 const points=values.points||[],old=b.points||[]
 for(const p of points)if(!p.id)lines.push('新增门店：'+p.name)
 for(const p of points){if(!p.id)continue;const o=old.find(x=>x.id===p.id);if(!o)continue;const changed=[[o.name,p.name,'名称'],[o.address,p.address,'地址'],[o.hours||'',p.hours||'','营业时间']].filter(([x,y])=>String(x??'')!==String(y??'')).map(x=>x[2]);if(Number(o.warehouseId)!==Number(p.warehouseId)||o.warehouseEnabled===false)changed.push('备货仓库');if(changed.length)lines.push('修改门店：'+p.name+'（'+changed.join('、')+'）')}
 for(const o of old)if(!points.some(p=>p.id===o.id))lines.push('删除门店：'+o.name+(Number(o.pendingPickups)>0?'（还有 '+o.pendingPickups+' 笔待自提订单，仍按原门店信息取货）':''))
 return lines
}
export function deliveryConfirmText(base,values,warehouses){const lines=deliveryChangeLines(base,values,warehouses);return lines.slice(0,8).join('\n')+(lines.length>8?'\n等共 '+lines.length+' 项修改':'')+'\n只影响之后的新订单，已下单的仍按下单时的规则。\n确认保存？'}
export function removePointConfirmText(p){const name=String(p?.name||'').trim()||'新门店';return Number(p?.pendingPickups)>0?'「'+name+'」还有 '+p.pendingPickups+' 笔待自提订单。删除后这些订单仍按原门店信息取货，新订单不能再选这家门店。确认删除？':'删除门店「'+name+'」？删除后新订单不能再选这家门店。'}
// After saving, the values read back must be what was sent; otherwise say so (for example a PC save in between).
export function afterSaveMismatch(kind,sent,fresh){
 if(kind==='withdrawal'){const now=fresh?.withdrawal?.values;if(!now)return '';return WITHDRAWAL_FIELDS.filter(([k])=>Number(now[k])!==Number(sent[k])).map(([k,label,t])=>'保存后读到的'+label+'是 '+valueText(t,now[k])+'，和刚才填写的不一致，请核对或到电脑后台查看。').join('')}
 if(kind==='service'){const now=fresh?.serviceFee?.distributorServiceRate;if(now===undefined||now===null)return '';return Number(now)!==Number(sent.distributorServiceRate)?'保存后读到的分销商平台服务费是 '+percentText(now)+'，和刚才填写的不一致，请核对或到电脑后台查看。':''}
 return ''
}
