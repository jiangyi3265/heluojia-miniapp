// Pure rules for the 商家工作台. No uni or network access here so every rule can be unit tested.
// What a person may see and do is decided by the server (GET /shop/app/staff/me); this file only
// turns those answers into screens, tabs and plain-language checks.

// Full-width letters and digits typed from a Chinese keyboard count as the normal ones.
const halfWidth=value=>String(value??'').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/　/g,' ')

export function normalizeBindCode(value){return halfWidth(value).replace(/[\s-]/g,'').toUpperCase()}
export function bindCodeError(value){
 const code=normalizeBindCode(value)
 if(!code)return '请输入绑定码'
 if(!/^[0-9A-Z]+$/.test(code))return '绑定码只有字母和数字，请核对后重新输入'
 if(code.length!==8)return '绑定码是8位，请核对后重新输入'
 return ''
}

export function normalizePickupCode(value){return halfWidth(value).replace(/\s+/g,'')}
export function pickupCodeError(value){
 const code=normalizePickupCode(value)
 if(!code)return '请输入顾客出示的自提码'
 if(!/^\d{8}$/.test(code))return '自提码是8位数字，请核对后重新输入'
 return ''
}

export function normalizeTracking(value){return halfWidth(value).replace(/\s+/g,'').toUpperCase()}
// Server limits: carrier 1–80 characters, tracking 1–100 characters.
export function shipFormError({carrier,tracking}={}){
 const name=halfWidth(carrier).trim(),number=normalizeTracking(tracking)
 if(!name)return '请填写物流公司'
 if(name.length>80)return '物流公司名称太长，请简化后再填'
 if(!number)return '请填写运单号'
 if(!/^[0-9A-Z-]+$/.test(number))return '运单号只能包含字母、数字或短横线，请核对'
 if(number.length<6)return '运单号太短，请核对后再填'
 if(number.length>100)return '运单号太长，请核对后再填'
 return ''
}

// 'unbound' → this WeChat is not linked to a staff account; 'no-orders' → linked, but the admin role
// does not include looking at orders; 'ok' → figures and order lists can be loaded.
export function staffAccess(me){
 if(!me||me.bound!==true)return 'unbound'
 return me.canViewOrders===true?'ok':'no-orders'
}

// 顶部一句话和下面的功能菜单一一对应：能改的写“处理、审核、管理”，只能看的写“查看”；每组只取第一项有的。
const ABILITIES=[
 [['canViewOrders','查看订单']],[['canShip','发货']],[['canCollectPickup','核销自提']],[['canViewMoney','查看收款']],[['canLookupCustomers','查客户订单']],
 [['canTopUpCustomers','给客户充值'],['canViewCustomerArchive','查看客户档案']],
 [['canHandleCases','处理售后'],['canViewCases','查看售后']],[['canReviewCustomers','审核客户'],['canViewCustomers','查看客户申请']],
 [['canEditProducts','管理商品'],['canViewProducts','查看商品']],[['canAdjustStock','调整库存'],['canViewStock','查看库存']],[['canReviewWithdrawals','审核提现']],
 [['canViewDashboard','查看经营数据']],[['canManageDistributors','管理分销商'],['canRegisterPartnerFees','登记加盟款'],['canViewDistributors','查看分销商']],
 [['canEditShopSettings','修改经营设置'],['canViewShopSettings','查看经营设置']]
]
export function abilityText(me){
 if(staffAccess(me)==='unbound')return ''
 if(ABILITIES.every(group=>me[group[0][0]]===true))return '可以使用下面全部功能'
 const parts=ABILITIES.map(group=>group.find(([key])=>me[key]===true)).filter(Boolean).map(([,label])=>label)
 return parts.length?'可以'+parts.join('、'):''
}

const VIEWS=[
 {view:'shipping',label:'待发货',needs:'canShip',count:'pendingShipment'},
 {view:'pickup',label:'待自提',needs:'canCollectPickup',count:'pendingPickup'},
 {view:'aftersale',label:'售后中',count:'afterSalesOpen'},
 {view:'all',label:'全部订单'}
]
// Only lists the person can act on or is allowed to read. Finance sees 售后中/全部订单 but not the
// shipping or pickup queues, which belong to people who can ship or hand over goods.
export function staffTabs(me){
 if(staffAccess(me)!=='ok')return []
 return VIEWS.filter(v=>!v.needs||me[v.needs]===true).map(({view,label,count})=>({view,label,count}))
}

// Each order row says what this person may do with it right now (shippable / preparable /
// collectable, already combined with their permissions and open after-sales). Buttons follow
// those flags; the server checks again on every action.
export function canShipOrder(order,me,view){
 return me?.canShip===true&&view==='shipping'&&order?.shippable===true
}
export function canPrepareOrder(order,me,view){
 return me?.canCollectPickup===true&&['pickup','all'].includes(view)&&order?.preparable===true
}
export function canCollectOrder(order,me,view){
 return me?.canCollectPickup===true&&['pickup','all'].includes(view)&&order?.collectable===true
}
export function pickupStatusText(order){
 if(order?.deliveryMethod!=='pickup')return ''
 return ({pending:'还没备货，备好后顾客才能来取',ready:'已备好货，等顾客到店出示自提码',collected:'顾客已取走'})[order.pickupStatus]||''
}

const DELIVERY={express:'快递配送',freight:'物流配送',local:'同城配送',pickup:'门店自提'}
// pickupStore may arrive as a plain name or as {name, address}.
export function pickupStore(order){
 const s=order?.pickupStore
 if(typeof s==='string')return {name:s.trim(),address:''}
 return s&&typeof s==='object'?{name:String(s.name||'').trim(),address:String(s.address||'').trim()}:{name:'',address:''}
}
export function deliveryText(order){
 const label=DELIVERY[order?.deliveryMethod]||'其他配送方式'
 const store=order?.deliveryMethod==='pickup'?pickupStore(order).name:''
 return store?label+' · '+store:label
}

export function yuan(fen){
 const value=Number(fen)
 if(!Number.isFinite(value))return '¥0.00'
 const sign=value<0?'-':'',[whole,cents]=(Math.abs(Math.round(value))/100).toFixed(2).split('.')
 return sign+'¥'+whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+cents
}
const count=value=>Number.isFinite(Number(value))&&Number(value)>0?Math.floor(Number(value)):0

// Cards for the top of the workbench. Sales and cash figures appear only for people allowed to see money
// (店主定：仓库、发货看不到店里的营业金额), and cash only when the server actually sent it.
export function overviewCards(overview,me){
 const o=overview||{}
 const sales=me?.canViewMoney!==true?[]:[
  {key:'today',label:'今天',orders:count(o.today?.orders),sales:yuan(o.today?.sales||0)},
  {key:'month',label:'本月',orders:count(o.month?.orders),sales:yuan(o.month?.sales||0)}
 ]
 const todo=[
  {key:'pendingShipment',view:'shipping',label:'待发货',value:count(o.pendingShipment)},
  {key:'pendingPickup',view:'pickup',label:'待自提',value:count(o.pendingPickup)},
  {key:'afterSalesOpen',view:'aftersale',label:'售后中',value:count(o.afterSalesOpen)}
 ]
 const cash=me?.canViewMoney===true&&o.cash&&typeof o.cash==='object'?[
  {key:'monthReceived',label:'本月实收',value:yuan(o.cash.monthReceived||0)},
  {key:'monthRefunded',label:'本月退款',value:yuan(o.cash.monthRefunded||0)},
  {key:'monthNet',label:'本月净收',value:yuan(o.cash.monthNet||0)}
 ]:[]
 return {sales,todo,cash}
}

export function emptyText(view){
 return ({
  shipping:{title:'暂时没有要发货的订单',hint:'顾客付款后，需要寄出的订单会出现在这里。'},
  pickup:{title:'暂时没有等待自提的订单',hint:'顾客选择到店自提并付款后，会出现在这里。'},
  aftersale:{title:'暂时没有进行中的售后',hint:'顾客申请退款、退货或换货后会出现在这里，可在手机管理的“售后处理”中查看和处理。'},
  all:{title:'还没有订单',hint:'顾客下单付款后，订单会出现在这里。'}
 })[view]||{title:'暂时没有订单',hint:''}
}

// Launch routing. A plain open of the mini-program (home or a bottom tab, no parameters) takes a
// bound staff member to the workbench. Shared links, QR codes and product pages always open as the
// customer sees them so referral binding and deep links keep working.
export const ENTRY_PATHS=['pages/skincare/index','pages/index/index','pages/category/index','pages/cart/index','pages/me/index']
// WeChat scenes for chat shares, group shares, moments, QR/mini-program codes, and URL links.
const LINK_SCENES=[1007,1008,1010,1011,1012,1013,1025,1031,1032,1036,1044,1047,1048,1049,1065,1096,1154,1155,1167,1194]
export function launchPath(path){return String(path||'').replace(/^\/+/,'').split('?')[0]}
export function isHomeLaunch(launch){
 if(!launch)return false
 const path=launchPath(launch.path)
 if(path&&!ENTRY_PATHS.includes(path))return false
 const query=launch.query&&typeof launch.query==='object'?launch.query:{}
 if(Object.keys(query).some(k=>query[k]!==undefined&&query[k]!==null&&String(query[k])!==''))return false
 return !LINK_SCENES.includes(Number(launch.scene))
}
export function shouldOpenWorkbench({launch,customerView=false,me}={}){
 return !customerView&&isHomeLaunch(launch)&&staffAccess(me)!=='unbound'
}
