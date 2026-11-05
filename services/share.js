// Always use a public cover: WeChat's default screenshot could expose a workbench.
const PUBLIC_COVER='https://luoluoht.oksja.cn/shop-assets/heluojia-studio-toner-20260920.png'
const validId=value=>/^[1-9][0-9]{0,14}$/.test(String(value||''))
const distributorId=member=>member?.distributor_state==='approved'&&validId(member.id)?String(member.id):''
const titleText=(value,fallback)=>String(value||'').trim().slice(0,80)||fallback
const productPath=(id,channel,member)=>'/pages/product/index?id='+id+'&channel='+(channel==='B'?'B':'C')+(distributorId(member)?'&referrer='+distributorId(member):'')

export function buildProductLink({id,channel='C',member,baseUrl='https://luoluo.oksja.cn'}) {
 if(!validId(id))throw Error('商品信息尚未加载，请刷新后重试')
 const base=String(baseUrl).replace(/\/+$/,'')
 if(!/^https?:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(base))throw Error('商城链接配置不正确，请联系商家')
 return base+'/#'+productPath(String(id),channel,member)
}

function currentMember(component){
 const token=uni.getStorageSync('shop-token'),owner=String(uni.getStorageSync('shop-owner')||'')
 if(!token||!validId(owner))return null
 const member=String(component?.member?.id)===owner?component.member:uni.getStorageSync('shop-member')
 return member&&String(member.id)===owner?member:null
}

// Page hooks must exist on each public page so uni-app registers native sharing.
// Read the public query as a fallback when the child component is not ready yet.
export function pageShare(screen,query={},event,component){
 return productShare({event,screen,query,member:currentMember(component),products:component?.products||[],selectedProduct:component?.selectedProduct,channel:query.channel||component?.channel||'C',shopName:component?.rules?.shopName,asset:component?.asset})
}

export function sharePage(screen,query={}) {return pageShare(screen,query)}

const PUBLIC_PAGES=['index','category','search','product']
export function pageTimeline(screen,query={},component){
 const payload=pageShare(screen,query,undefined,component)
 return {title:payload.title,imageUrl:payload.imageUrl,query:PUBLIC_PAGES.includes(screen)?payload.path.split('?')[1]||'':''}
}

export function pageCopyQuery(screen,query={},component){
 return PUBLIC_PAGES.includes(screen)?pageShare(screen,query,undefined,component).path.split('?')[1]||'':''
}

let activeCopy=null,shareOwner=null
export function hidePageSharing(owner){
 // #ifdef MP-WEIXIN
 if(shareOwner===owner)shareOwner=null
 if(activeCopy?.owner!==owner)return
 activeCopy=null
 if(typeof wx!=='undefined'&&typeof wx.offCopyUrl==='function'){try{wx.offCopyUrl()}catch{}}
 // #endif
}

export function showPageSharing(owner,screen){
 // #ifdef MP-WEIXIN
 if(typeof wx==='undefined')return
 if(activeCopy&&activeCopy.owner!==owner)hidePageSharing(activeCopy.owner)
 const timeline=PUBLIC_PAGES.includes(screen)
 if(!timeline&&!['distribution','promote','promo-materials'].includes(screen))return
 shareOwner=owner
 if(typeof wx.showShareMenu==='function'){
  const menus=timeline?['shareAppMessage','shareTimeline']:['shareAppMessage']
  try{wx.showShareMenu({menus,fail:()=>{if(timeline&&shareOwner===owner)wx.showShareMenu({menus:['shareAppMessage']})}})}catch{}
 }
 // offCopyUrl removes all listeners; only the currently active page may call it.
 // Feature detection keeps older WeChat clients and H5 unaffected.
 if(!timeline||activeCopy?.owner===owner||typeof wx.onCopyUrl!=='function'||typeof wx.offCopyUrl!=='function')return
 const entry={owner};activeCopy=entry
 try{wx.onCopyUrl(()=>({query:activeCopy===entry?pageCopyQuery(screen,owner.query||{},owner.$refs?.screen):''}))}
 catch{if(activeCopy===entry)activeCopy=null}
 // #endif
}

export function productShare({event,member,products=[],selectedProduct,channel='C',shopName,asset,screen='index',query={}}) {
 const d=event?.target?.dataset||{},referrer=distributorId(member)
 const brand=titleText(shopName,'赫洛嘉')
 if(d.shareKind==='recruit'&&referrer)return {title:titleText(d.shareTitle,'邀请你成为商城分销伙伴'),path:'/pages/distributor-apply/index?referrer='+referrer,imageUrl:PUBLIC_COVER}
 const candidate=d.productId??selectedProduct?.id??(screen==='product'?query.id:null)
 if(validId(candidate)){
  const id=String(candidate),product=products.find(p=>String(p.id)===id)||(String(selectedProduct?.id)===id?selectedProduct:null)
  const payload={title:titleText(d.shareTitle||product?.name,brand+' · 商品分享'),path:productPath(id,d.channel||channel,member),imageUrl:PUBLIC_COVER}
  if(product?.image&&typeof asset==='function'){try{payload.imageUrl=asset(product.image,640)||PUBLIC_COVER}catch{}}
  return payload
 }
 // Only public route parameters are copied. Never forward incoming referrer,
 // account IDs, order IDs, tokens or arbitrary query keys from the current page.
 let path='/pages/index/index'
 if(['category','search'].includes(screen)){
  const params=[]
  if(query.category)params.push('category='+encodeURIComponent(String(query.category).slice(0,80)))
  if(screen==='search'&&query.keyword)params.push('keyword='+encodeURIComponent(String(query.keyword).slice(0,80)))
  if(channel==='B')params.push('channel=B')
  path='/pages/'+screen+'/index'+(params.length?'?'+params.join('&'):'')
 }
 if(referrer)path+=(path.includes('?')?'&':'?')+'referrer='+referrer
 return {title:brand,path,imageUrl:PUBLIC_COVER}
}
