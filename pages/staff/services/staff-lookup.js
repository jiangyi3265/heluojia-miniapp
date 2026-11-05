// 客户订单 (phone). Pure rules only: no imports, no uni, no network, so node tests can load this file directly.
const halfWidth=v=>String(v??'').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/　/g,' ')

// The server's search grammar and words: a search the server would refuse is never sent.
export function classifySearch(input){
 const raw=halfWidth(input).trim(),s=raw.replace(/[\s-]/g,'')
 if(!raw)return {error:'请输入手机号、订单号、昵称或会员号'}
 if(raw.length>40)return {error:'搜索内容最多40个字'}
 if(s[0]==='#')return /^#[1-9]\d{0,17}$/.test(s)?{kind:'memberId',value:s}:{error:'会员编号请输入 # 加数字，例如 #123'}
 if(/^\d{11}$/.test(s))return {kind:'phone',value:s}
 if(/^\d{4}$/.test(s))return {kind:'phoneTail',value:s}
 if(/^bc\d/i.test(s))return /^bc\d{6}[0-9a-z]{0,32}$/i.test(s)?{kind:'order',value:'BC'+s.slice(2)}:{error:'订单号至少输入 BC 加 6 位数字'}
 if(/^\d+$/.test(s))return {error:'请输入完整的11位手机号、手机号后4位、以 BC 开头的订单号，或在会员号前加 #（例如 #123）'}
 if([...raw].length<2)return {error:'昵称至少输入2个字'}
 return {kind:'nickname',value:raw}
}
export const SEARCH_HELP='11位手机号精确查找；4位数字查手机尾号；BC开头查订单号；# 加数字查会员编号，例如 #123；其他按昵称查（至少2个字）。'
export const SEARCH_KIND_LABEL={phone:'手机号',phoneTail:'手机尾号',order:'订单号',memberId:'会员编号',nickname:'昵称'}
export const identityText=list=>{const t=(Array.isArray(list)?list:[]).filter(x=>typeof x==='string'&&x.trim());return t.length?t.join(' · '):'顾客'}
const STATUS={pending:'待付款',paid:'待发货',shipping:'部分发货',shipped:'待收货',completed:'已完成',cancelled:'已取消',refunded:'已退款'}
export const orderStatusText=o=>o?.statusLabel||STATUS[o?.status]||'处理中'
// Only a full mainland mobile number can be dialled; a masked one (138****1234) cannot.
export const callablePhone=p=>/^1\d{10}$/.test(String(p||''))
export const memberTitle=m=>String(m?.realName||'').trim()||String(m?.nickname||'').trim()||'商城顾客'
export const personLine=p=>String(p?.name||'').trim()+'（会员编号 '+p?.memberId+'）'
const fen=v=>Number(v)||0
// 客户的余额块。商城余额是现在能用的钱；待付款订单占用的钱下单时已经从余额里扣出，不在商城余额里，所以单列“另有…”，不能写成“其中…”。
export function walletLines(w){
 const online=w?.online||{},legacy=w?.legacy||{},lines=[{label:'商城余额',value:fen(online.available)}]
 if(fen(online.reserved)>0)lines.push({label:'另有待付款订单占用',value:fen(online.reserved)})
 if(fen(legacy.available)>0)lines.push({label:'门店余额',value:fen(legacy.available)})
 if(fen(w?.refundFrozen)>0)lines.push({label:'充值退款处理中',value:fen(w.refundFrozen)})
 return lines
}
// 订单的金额块（不含实付那行）。服务器给的“优惠”已经不含积分那部分（与电脑后台、顾客自己的订单一致），这里不再相减；
// 减项的 value 是负数，各行相加正好等于实付金额。
export function orderAmountLines(a){
 const lines=[{label:'商品金额',value:fen(a?.subtotal)},{label:'运费',value:fen(a?.shipping)}]
 if(fen(a?.discount)>0)lines.push({label:'优惠',value:-fen(a.discount)})
 if(fen(a?.pointsDiscount)>0)lines.push({label:a.pointsExchange?'积分兑换':'积分抵扣',value:-fen(a.pointsDiscount)})
 return lines
}
// Customer → order → customer … keeps the last few screens so 返回 works without re-reading.
export function pushView(stack,entry,max=6){const next=[...(Array.isArray(stack)?stack:[]),entry];return next.length>max?next.slice(next.length-max):next}
