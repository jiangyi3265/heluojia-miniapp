import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync(new URL('../services/share.js',import.meta.url),'utf8').replaceAll('export ','')
const approved={id:31,distributor_state:'approved'}
function fixture(member=approved,wx){
 const storage=new Map(member?[['shop-token','test-token'],['shop-owner',member.id],['shop-member',member]]:[])
 const api=new Function('uni','wx',source+';return {pageShare,productShare,sharePage,buildProductLink,pageTimeline,pageCopyQuery,showPageSharing,hidePageSharing}')({getStorageSync:key=>storage.get(key)},wx)
 return {...api,storage}
}
function pageOptions(name,pageShare,api={}){
 const text=readFileSync(new URL('../pages/'+name+'/index.vue',import.meta.url),'utf8')
 const script=text.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'').replace('export default','return')
 return new Function('ShopScreen','pageShare','promotionQuery','pageTimeline','showPageSharing','hidePageSharing',script)({},pageShare,q=>q,api.pageTimeline,api.showPageSharing,api.hidePageSharing)
}

test('public page native hooks return usable public payload before the child ref is ready',()=>{
 const f=fixture()
 for(const screen of ['index','category','search','product','promote','distribution','promo-materials']){
  const page=pageOptions(screen,f.pageShare),query=screen==='product'?{id:'1001',channel:'B'}:{}
  const result=page.onShareAppMessage.call({query,$refs:{}},{from:'menu'})
  assert.match(result.path,/referrer=31/)
  assert.ok(result.imageUrl.startsWith('https://'))
  if(screen==='product')assert.equal(result.path,'/pages/product/index?id=1001&channel=B&referrer=31')
  if(['promote','distribution','promo-materials'].includes(screen))assert.equal(result.path,'/pages/index/index?referrer=31')
 }
})
test('account and order pages never register native share callbacks',()=>{
 for(const name of ['orders','order-detail','sales-orders','me','settings','wallet','withdraw','withdrawals','customers','customer-profile','addresses','invoices']){
  const source=readFileSync(new URL('../pages/'+name+'/index.vue',import.meta.url),'utf8')
  assert.equal(/onShareAppMessage\s*\(|onShareTimeline\s*\(/.test(source),false,name)
 }
})
test('material button preserves its product, channel and edited title before catalog loads',()=>{
 const f=fixture(),event={from:'button',target:{dataset:{shareKind:'product',productId:'2024',channel:'B',shareTitle:'  我的精选套装  '}}}
 const result=f.pageShare('promo-materials',{},event,{products:[],channel:'C'})
 assert.equal(result.path,'/pages/product/index?id=2024&channel=B&referrer=31')
 assert.equal(result.title,'我的精选套装')
 assert.ok(result.imageUrl)
})
test('loaded product keeps product image and name for menu sharing',()=>{
 const f=fixture(),product={id:1001,name:'精华水',image:'/product.png'}
 const result=f.pageShare('product',{id:1001},{from:'menu'},{member:approved,products:[product],selectedProduct:product,asset:(p,w)=>'https://images.example'+p+'?width='+w})
 assert.equal(result.title,'精华水');assert.equal(result.imageUrl,'https://images.example/product.png?width=640')
 assert.equal(result.path,'/pages/product/index?id=1001&channel=C&referrer=31')
})
test('product query fallback keeps B channel while component is still at its default C channel',()=>{
 const f=fixture(),result=f.pageShare('product',{id:1001,channel:'B'},{from:'menu'},{channel:'C',products:[],member:null})
 assert.equal(result.path,'/pages/product/index?id=1001&channel=B&referrer=31')
})
test('explicit material product never falls back to an unrelated selected product',()=>{
 const {productShare}=fixture(),result=productShare({member:approved,event:{target:{dataset:{productId:'2024'}}},selectedProduct:{id:1001,name:'其他商品'}})
 assert.equal(result.path,'/pages/product/index?id=2024&channel=C&referrer=31')
 assert.notEqual(result.title,'其他商品')
})
test('invalid product IDs cannot inject query params or share an unrelated product',()=>{
 const {productShare}=fixture()
 for(const id of ['0','-1','1.2','1001&token=secret','1e3','1000000000000000']){
  const out=productShare({member:approved,event:{target:{dataset:{productId:id}}},selectedProduct:{id:1001}})
  assert.equal(out.path,'/pages/index/index?referrer=31')
 }
})
test('recruit button requires approval and never shares the private workbench screenshot',()=>{
 const {productShare}=fixture(),event={target:{dataset:{shareKind:'recruit',shareTitle:'邀请你加入'}}}
 const yes=productShare({member:approved,event}),no=productShare({member:{...approved,distributor_state:'pending'},event})
 assert.equal(yes.path,'/pages/distributor-apply/index?referrer=31');assert.equal(yes.title,'邀请你加入');assert.ok(yes.imageUrl)
 assert.equal(no.path,'/pages/index/index');assert.ok(no.imageUrl)
})
test('category/search only share encoded public filters and current approved referrer',()=>{
 const f=fixture(),out=f.pageShare('search',{category:'水&乳',keyword:'面霜?referrer=99',referrer:'99',token:'secret',orderId:44})
 const url=new URL('https://test.example'+out.path)
 assert.equal(url.pathname,'/pages/search/index');assert.equal(url.searchParams.get('category'),'水&乳');assert.equal(url.searchParams.get('keyword'),'面霜?referrer=99');assert.equal(url.searchParams.get('referrer'),'31')
 assert.equal(url.searchParams.has('token'),false);assert.equal(url.searchParams.has('orderId'),false)
})
test('guest and ordinary users do not reassign someone else’s incoming referral',()=>{
 for(const member of [null,{id:88,distributor_state:'none'}]){
  const f=fixture(member),out=f.pageShare('product',{id:1001,referrer:31})
  assert.equal(out.path,'/pages/product/index?id=1001&channel=C')
 }
})
test('expired and mismatched account caches never leak a former distributor ID',()=>{
 const f=fixture();f.storage.delete('shop-token')
 assert.equal(f.pageShare('index',{},null,{member:approved}).path,'/pages/index/index')
 f.storage.set('shop-token','other-token');f.storage.set('shop-owner',88)
 assert.equal(f.pageShare('index',{},null,{member:approved}).path,'/pages/index/index')
 f.storage.set('shop-member',{id:88,distributor_state:'approved'})
 assert.equal(f.pageShare('index',{},null,{member:approved}).path,'/pages/index/index?referrer=88')
})
test('public product links work for ordinary customers and approved distributors',()=>{
 const {buildProductLink}=fixture()
 assert.equal(buildProductLink({id:1001}),'https://luoluo.oksja.cn/#/pages/product/index?id=1001&channel=C')
 assert.equal(buildProductLink({id:'1001',channel:'B',member:approved}),'https://luoluo.oksja.cn/#/pages/product/index?id=1001&channel=B&referrer=31')
 assert.equal(buildProductLink({id:1001,member:{id:88,distributor_state:'pending'}}).includes('referrer'),false)
 assert.throws(()=>buildProductLink({id:'1001&referrer=9'}),/商品信息/)
 assert.throws(()=>buildProductLink({id:1001,baseUrl:'javascript:alert(1)'}),/链接配置/)
})
test('missing image resolver retains a safe public cover and long material title is bounded',()=>{
 const {productShare}=fixture(),out=productShare({member:approved,selectedProduct:{id:1001,image:'/image.png'},event:{target:{dataset:{shareTitle:'新'.repeat(100)}}},asset:()=>{throw Error('not ready')}})
 assert.equal(out.title.length,80);assert.ok(out.imageUrl.startsWith('https://'));assert.equal(out.path,'/pages/product/index?id=1001&channel=C&referrer=31')
})

test('timeline hooks only use query and public image on the four genuinely public pages',()=>{
 const f=fixture()
 for(const name of ['index','category','search','product']){
  const page=pageOptions(name,f.pageShare,f),query={id:1001,channel:'C',referrer:99,token:'secret',orderId:44}
  const payload=page.onShareTimeline.call({query,$refs:{}})
  assert.deepEqual(Object.keys(payload).sort(),['imageUrl','query','title'])
  const parsed=new URLSearchParams(payload.query)
  assert.equal(parsed.get('referrer'),'31');assert.equal(parsed.has('token'),false);assert.equal(parsed.has('orderId'),false)
  assert.equal(parsed.get('id'),name==='product'?'1001':null)
 }
 for(const name of ['distribution','promote','promo-materials'])assert.equal(pageOptions(name,f.pageShare,f).onShareTimeline,undefined)
})
test('copy query filters private values and never treats copied links as another distributor',()=>{
 const f=fixture(),query=f.pageCopyQuery('product',{id:1001,channel:'B',referrer:99,token:'secret',phone:'private'})
 assert.equal(query,'id=1001&channel=B&referrer=31')
 assert.equal(f.pageCopyQuery('orders',{id:44,token:'secret'}),'')
 f.storage.clear()
 assert.equal(f.pageCopyQuery('product',{id:1001,referrer:99}),'id=1001&channel=C')
})
test('native copy reads latest member and product at click time, not on page entry',()=>{
 const listeners=[],menus=[],wx={showShareMenu:o=>menus.push(o),onCopyUrl:f=>listeners.push(f),offCopyUrl:()=>{}}
 const f=fixture(approved,wx),owner={query:{id:1001},$refs:{}}
 f.showPageSharing(owner,'product')
 assert.deepEqual(menus[0].menus,['shareAppMessage','shareTimeline'])
 assert.deepEqual(listeners[0](),{query:'id=1001&channel=C&referrer=31'})
 owner.$refs.screen={selectedProduct:{id:1002},member:{id:88,distributor_state:'approved'}}
 f.storage.set('shop-owner',88);f.storage.set('shop-member',owner.$refs.screen.member)
 assert.deepEqual(listeners[0](),{query:'id=1002&channel=C&referrer=88'})
 f.storage.delete('shop-token')
 assert.deepEqual(listeners[0](),{query:'id=1002&channel=C'})
})
test('old page hide/unload cannot remove the active page copy listener',()=>{
 const listeners=[],offArgs=[],wx={showShareMenu:()=>{},onCopyUrl:f=>listeners.push(f),offCopyUrl:(...args)=>offArgs.push(args)}
 const f=fixture(approved,wx),first={query:{id:1001},$refs:{}},second={query:{id:1002},$refs:{}}
 f.showPageSharing(first,'product');f.showPageSharing(first,'product');assert.equal(listeners.length,1)
 f.showPageSharing(second,'product');assert.equal(listeners.length,2);assert.deepEqual(offArgs,[[]])
 f.hidePageSharing(first);assert.equal(offArgs.length,1)
 assert.deepEqual(listeners[0](),{query:''});assert.deepEqual(listeners[1](),{query:'id=1002&channel=C&referrer=31'})
 f.hidePageSharing(second);f.hidePageSharing(second);assert.deepEqual(offArgs,[[],[]]);assert.deepEqual(listeners[1](),{query:''})
})
test('workbench menus expose only friend sharing and remove any previous public copy listener',()=>{
 let copied=0,off=0;const menus=[],wx={showShareMenu:o=>menus.push(o.menus),onCopyUrl:()=>copied++,offCopyUrl:()=>off++},f=fixture(approved,wx)
 f.showPageSharing({query:{},$refs:{}},'index')
 f.showPageSharing({query:{},$refs:{}},'distribution')
 assert.deepEqual(menus,[['shareAppMessage','shareTimeline'],['shareAppMessage']]);assert.equal(copied,1);assert.equal(off,1)
})
test('unsupported native copy APIs do not break page entry and stale menu failures do not alter next page',()=>{
 const menus=[],wx={showShareMenu:o=>menus.push(o),onCopyUrl:()=>{throw Error('must not register without off API')}}
 const f=fixture(approved,wx),owner={query:{},$refs:{}}
 assert.doesNotThrow(()=>f.showPageSharing(owner,'index'))
 f.hidePageSharing(owner);menus[0].fail();assert.equal(menus.length,1)
 assert.doesNotThrow(()=>fixture().showPageSharing(owner,'index'))
})
test('page show/hide/unload lifecycle owns native menu and copy registration',()=>{
 let copies=0,offs=0;const f=fixture(approved,{showShareMenu:()=>{},onCopyUrl:()=>copies++,offCopyUrl:()=>offs++})
 const page=pageOptions('index',f.pageShare,f),owner={query:{},$refs:{screen:{resume(){},suspend(){},refresh(){}}},$nextTick:fn=>fn(),shown:false}
 page.onShow.call(owner);assert.equal(copies,1);page.onHide.call(owner);page.onUnload.call(owner);assert.equal(offs,1)
 page.onShow.call(owner);assert.equal(copies,2)
})
