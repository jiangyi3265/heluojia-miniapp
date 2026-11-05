import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,statSync} from 'node:fs'
import {createRequire} from 'node:module'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// 2026-09-30 店主定（D4）：网页版（H5）不隐藏购买按钮，但每一个走到死路的地方都要说清楚原因、
// 告诉顾客怎么打开小程序；复制链接的按钮不能让人以为网页链接可以直接下单。
// 这里把真实的说明函数、真实的组件方法和真实的模板片段跑一遍，看顾客在网页上实际看到的文字。
const require=createRequire(import.meta.url)
const {createSSRApp}=require('vue'),{renderToString}=require('vue/server-renderer'),{toRaw}=require('@vue/reactivity')
const guide=await loadHelpers('../services/h5-guide.js')
const SHOP='赫洛嘉美妆'
const read=rel=>readFileSync(new URL(rel,import.meta.url),'utf8')
const screenSource=read('../components/ShopScreen.vue')
const BANNED=/H5|浏览器|凭证|接口|token|URL|API|http/i

// 渲染一段模板（小程序标签当作普通标签），返回顾客看到的文字，每个标签之间用换行隔开。
async function render(template,vm){
 const app=createSSRApp({template:'<view>'+template+'</view>',setup:()=>vm})
 app.config.compilerOptions.isCustomElement=tag=>['view','text','image','input','textarea','picker','switch','scroll-view'].includes(tag)
 app.config.warnHandler=()=>{}
 const html=(await renderToString(app)).replace(/<!--[\s\S]*?-->/g,'')
 return {html,text:html.replace(/<[^>]+>/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean).join('\n')}
}
// 组件里有些东西是计算属性（只读）：测试要换成指定的值时，直接换掉它的取值方式。
function setState(vm,state){
 const raw=toRaw(vm)
 for(const [key,value] of Object.entries(state)){
  if(Object.getOwnPropertyDescriptor(raw,key)?.get)Object.defineProperty(raw,key,{get:()=>value,configurable:true,enumerable:false})
  else vm[key]=value
 }
}
// 取出从 start 开始的那一个 <template>…</template>（含里面嵌套的 template）。
function block(source,start){
 const from=source.indexOf(start)
 assert.ok(from>=0,'没有找到 '+start)
 const re=/<template\b|<\/template>/g;re.lastIndex=from
 let depth=0
 for(let m;(m=re.exec(source));){depth+=m[0]==='</template>'?-1:1;if(depth===0)return source.slice(from,m.index+m[0].length)}
 throw Error('没有闭合 '+start)
}
// 取出 from 到 to（含）之间的一小段模板。
function snippet(source,from,to){
 const i=source.indexOf(from);assert.ok(i>=0,'没有找到 '+from)
 const j=source.indexOf(to,i);assert.ok(j>=0,'没有找到 '+to)
 return source.slice(i,j+to.length)
}

// 真实的 ShopScreen 方法和计算属性；它 import 的东西换成替身，只有用到的几个有真实行为。
function loadShopScreen({props={},requests=[],toasts=[],copied=[],paid=[],uniExtra={}}={}){
 const script=screenSource.match(/<script>([\s\S]*?)<\/script>/)[1]
 const deps={}
 for(const m of script.matchAll(/^import\s+(.+?)\s+from\s+['"][^'"]+['"]\s*$/gm)){
  const clause=m[1],named=clause.match(/\{([^}]*)\}/),def=clause.match(/^([A-Za-z_$][\w$]*)/)
  for(const name of [def?.[1],...(named?named[1].split(',').map(s=>s.trim()).filter(Boolean):[])].filter(Boolean))deps[name]=/^[A-Z]/.test(name)?{}:()=>undefined
 }
 Object.assign(deps,{
  RELEASE_VERSION:'test',labels:{},
  h5StopGuide:guide.h5StopGuide,h5ActionText:guide.h5ActionText,h5PayText:guide.h5PayText,copyLinkNote:guide.copyLinkNote,
  notify:e=>toasts.push(e?.message||String(e)),
  request:(...args)=>{requests.push(args);return Promise.resolve({})},
  payWithWechat:(...args)=>{paid.push(args);return Promise.resolve()},
  copyText:value=>{copied.push(value);return Promise.resolve(true)},
  getToken:()=>'',money:v=>Number(v).toFixed(2),asset:v=>v,
 })
 globalThis.uni=fakeUni(toasts,true,uniExtra)
 return loadComponent('../components/ShopScreen.vue',deps,{screen:'login',query:{},...props})
}

test('说明函数：店铺名、搜索方法、没有技术词',()=>{
 assert.equal(guide.miniProgramName('  赫洛嘉美妆  '),'赫洛嘉美妆')
 assert.equal(guide.miniProgramName(''),'赫洛嘉','还没取到店铺名时用品牌名')
 assert.equal(guide.miniProgramName(undefined),'赫洛嘉')
 assert.equal(guide.miniProgramName('长'.repeat(50)).length,30)
 const stop=guide.h5StopGuide(SHOP)
 assert.equal(stop.title,'请在微信小程序里登录和下单')
 assert.match(stop.reason,/网页版只能浏览商品，不能登录，也不能下单、付款/)
 assert.match(stop.how,/打开微信.*搜索框.*「赫洛嘉美妆」.*小程序/)
 assert.equal(stop.name,SHOP);assert.equal(stop.note,'')
 assert.match(guide.h5StopGuide(SHOP,{fromCheckout:true}).note,/选好的商品不会带到小程序/)
 const texts=[...Object.values(stop),guide.h5ActionText(SHOP,'登录'),guide.h5ActionText(SHOP,'付款'),guide.h5PayText(SHOP),...['product','promoter','invite'].map(k=>guide.copyLinkNote(SHOP,k))]
 for(const t of texts)assert.doesNotMatch(t,BANNED,t)
 assert.equal(guide.h5ActionText(SHOP,'登录'),'网页版不能登录，请在微信里搜索「赫洛嘉美妆」小程序后再登录')
 assert.match(guide.h5PayText(SHOP),/不能付款.*「赫洛嘉美妆」.*我的订单/)
})

test('复制链接的说明：只能看不能下单；推广人员知道怎样记在自己名下；邀请链接不能直接申请',()=>{
 const product=guide.copyLinkNote(SHOP),promoter=guide.copyLinkNote(SHOP,'promoter'),invite=guide.copyLinkNote(SHOP,'invite')
 assert.match(product,/只能用来看，不能登录下单/);assert.match(product,/「赫洛嘉美妆」小程序/)
 assert.doesNotMatch(product,/记在你名下/,'普通顾客没有推荐关系的说法')
 assert.ok(promoter.startsWith(product));assert.match(promoter,/记在你名下.*分享按钮/)
 assert.match(invite,/不能直接申请成为分销伙伴/);assert.match(invite,/邀请伙伴/)
})

test('网页版登录页：顾客看到原因、怎么打开小程序，并能一键复制小程序名称',async()=>{
 const toasts=[],copied=[]
 const {vm}=loadShopScreen({toasts,copied})
 vm.isWechat=false;vm.rules={shopName:SHOP}
 const login=block(screenSource,`<template v-if="screen==='login'">`)
 const {text}=await render(login,vm)
 assert.match(text,/请在微信小程序里登录和下单/)
 assert.match(text,/网页版只能浏览商品，不能登录，也不能下单、付款/)
 assert.match(text,/打开微信，点顶部的搜索框，输入「赫洛嘉美妆」，找到我们的小程序点开。登录后再下单/)
 assert.match(text,/复制小程序名称/)
 assert.match(text,/暂不登录，先逛逛/,'仍可继续浏览')
 assert.doesNotMatch(text,/一键登录|已阅读并同意|登录凭证/,'网页上不再出现点了没用的登录按钮和技术说明')
 assert.doesNotMatch(text,/在网页里选好的商品不会带到小程序/,'不是从结算页来的就不提购物车')
 // 点“复制小程序名称”复制的就是店铺名
 await vm.copy(vm.h5Guide().name);await settle()
 assert.deepEqual(copied,[SHOP])
})

test('从结算页被带到网页登录页时，提醒网页里选好的商品不会带到小程序',async()=>{
 const {vm}=loadShopScreen({uniExtra:{getStorageSync:key=>key==='shop-return'?{screen:'checkout',query:{}}:''}})
 vm.isWechat=false;vm.rules={shopName:SHOP}
 const {text}=await render(block(screenSource,`<template v-if="screen==='login'">`),vm)
 assert.match(text,/在网页里选好的商品不会带到小程序，请在小程序里重新选择/)
 assert.match(text,/请在微信小程序里登录和下单/)
})

test('店铺名没取到时网页登录页用品牌名；小程序里仍显示正常的微信登录，不出现网页说明',async()=>{
 const {vm}=loadShopScreen()
 vm.isWechat=false;vm.rules={}
 const login=block(screenSource,`<template v-if="screen==='login'">`)
 assert.match((await render(login,vm)).text,/输入「赫洛嘉」/)
 vm.isWechat=true;vm.agreed=false;vm.demoMode=true
 const wx=(await render(login,vm)).text
 assert.match(wx,/微信一键登录/)
 assert.doesNotMatch(wx,/请在微信小程序里登录和下单|复制小程序名称/)
})

test('网页上点登录：不发任何请求，弹出说清楚的中文提示',async()=>{
 const toasts=[],requests=[]
 const {vm}=loadShopScreen({toasts,requests})
 vm.isWechat=false;vm.rules={shopName:SHOP}
 await vm.wechatLogin();await settle()
 assert.deepEqual(toasts,['网页版不能登录，请在微信里搜索「赫洛嘉美妆」小程序后再登录'])
 assert.equal(requests.length,0,'没有向服务器发登录请求')
 assert.equal(vm.busy,false,'按钮不会卡在处理中')
})

test('网页上付款：收银台用同一套话取代付款按钮；强行提交也不付款、不发请求',async()=>{
 const toasts=[],requests=[],paid=[]
 const {vm}=loadShopScreen({toasts,requests,paid,props:{screen:'cashier',query:{id:'88'}}})
 setState(vm,{isWechat:false,wechatPayReady:true,demoMode:false,rules:{shopName:SHOP},member:{id:3},
  currentOrder:{id:88,order_no:'HL88',amount:199,external_amount:199,credit_order:false,rules_json:'{}',expires_at:'2026-10-01 10:00:00',status:'pending'}})
 const {text}=await render(block(screenSource,`<template v-if="screen==='cashier'">`),vm)
 assert.match(text,/网页版不能付款。打开微信，点顶部的搜索框，输入「赫洛嘉美妆」，找到我们的小程序点开。在“我的订单”里完成付款/)
 assert.doesNotMatch(text,/确认付款|立即支付|网页暂不支持/,'网页上没有可点的付款按钮')
 await vm.pay();await settle()
 assert.deepEqual(toasts,['网页版不能付款，请在微信里搜索「赫洛嘉美妆」小程序后再付款'])
 assert.equal(paid.length,0,'没有拉起微信支付');assert.equal(requests.length,0,'没有向服务器发付款请求')
})

test('商品页、选品推广页、邀请伙伴、推广素材：复制链接的按钮不再写“复制商品/邀请/推广链接”，旁边写明用途',async()=>{
 const {vm}=loadShopScreen({props:{screen:'product'}})
 setState(vm,{isWechat:false,rules:{shopName:SHOP},copying:false,channel:'C',selectedProduct:{id:5,name:'修护精华'}})
 // 商品详情
 const detail=await render(snippet(screenSource,'<view class="product-share-actions">',`{{linkNote()}}</text>`),vm)
 assert.match(detail.text,/复制商品浏览链接/);assert.doesNotMatch(detail.text,/复制商品链接/)
 assert.match(detail.text,/复制的网页链接只能用来看，不能登录下单。朋友想下单，请让他在微信里搜索「赫洛嘉美妆」小程序。/)
 assert.doesNotMatch(detail.text,/分享给微信好友/,'网页上没有微信分享按钮')
 vm.isWechat=true
 assert.match((await render(snippet(screenSource,'<view class="product-share-actions">',`{{linkNote()}}</text>`),vm)).text,/分享给微信好友[\s\S]*复制商品浏览链接/,'小程序里两个按钮都在')
 vm.isWechat=false
 // 选品推广页：每件商品的按钮 + 页面顶部的一条说明
 const promote=block(screenSource,`<template v-if="screen==='promote'">`)
 setState(vm,{screen:'promote',selfPurchaseProfile:null,products:[{id:1,name:'A',spec:'30ml',price:100,image:''}],filteredProducts:[{id:1,name:'A',spec:'30ml',price:100,image:''}],visibleCount:20})
 vm.unitPrice=()=>100
 const promoted=await render(promote,vm)
 assert.match(promoted.text,/复制商品浏览链接/);assert.doesNotMatch(promoted.text,/复制商品链接/)
 assert.match(promoted.text,/复制的网页链接只能用来看，不能登录下单。[\s\S]*想让朋友记在你名下，请在小程序里用分享按钮转发给他/)
 // 邀请伙伴
 const invite=await render(snippet(screenSource,'<view class="white-card"><view class="line"><text>招募分销伙伴</text>',`{{linkNote('invite')}}</text></view>`),vm)
 assert.match(invite.text,/复制邀请网页链接/);assert.doesNotMatch(invite.text,/复制邀请链接/)
 assert.match(invite.text,/不能直接申请成为分销伙伴.*「赫洛嘉美妆」小程序.*邀请伙伴/s)
 vm.isWechat=true
 const inviteWx=await render(snippet(screenSource,'<view class="white-card"><view class="line"><text>招募分销伙伴</text>',`{{linkNote('invite')}}</text></view>`),vm)
 assert.doesNotMatch(inviteWx.text,/复制邀请网页链接/,'小程序里仍是原生的“邀请伙伴”按钮')
})

test('推广素材页：按钮改名，页面上方写明网页链接只能浏览',async()=>{
 const rows=[{id:1,category:'精华',title:'修护精华',copy_text:'好用',link:'https://shop.example/#/pages/product/index?id=1',image:'/a.png',target:'product',product_id:1,channel:'C',invitationCode:'HL123',estimatedCommission:0}]
 const {vm}=loadComponent('../components/PromoMaterials.vue',{copyLinkNote:guide.copyLinkNote,request:()=>Promise.resolve([]),asset:v=>v,money:v=>String(v),API_BASE:'',getToken:()=>'',notify(){},copyText:()=>Promise.resolve(true),CopyFallback:{}},{shopName:SHOP})
 vm.rows=rows;vm.drafts={1:{title:'修护精华',copyText:'好用',revision:0}}
 const source=read('../components/PromoMaterials.vue'),template=source.match(/<template>([\s\S]*)<\/template>\s*<script>/)[1]
 const {text}=await render(template.replace(/<CopyFallback[^>]*\/>/,''),vm)
 assert.match(text,/复制网页链接/);assert.doesNotMatch(text,/复制推广链接/)
 assert.match(text,/复制的网页链接只能用来看，不能登录下单。朋友想下单，请让他在微信里搜索「赫洛嘉美妆」小程序。想让朋友记在你名下，请在小程序里用分享按钮转发给他。/)
 // 没传店铺名时用品牌名
 const bare=loadComponent('../components/PromoMaterials.vue',{copyLinkNote:guide.copyLinkNote,request(){},asset(){},money(){},API_BASE:'',getToken(){},notify(){},copyText(){},CopyFallback:{}}).vm
 assert.match(bare.linkNote,/「赫洛嘉」小程序/)
})

test('全部页面和组件里不再有会让人以为网页链接能下单的旧按钮名和旧提示',()=>{
 const files=[]
 for(const dir of ['../components','../pages','../services']){
  const walk=d=>{for(const name of readdirSync(new URL(d+'/',import.meta.url))){const rel=d+'/'+name;if(statSync(new URL(rel,import.meta.url)).isDirectory())walk(rel);else if(/\.(vue|js)$/.test(name))files.push(rel)}}
  walk(dir)
 }
 for(const rel of files){
  const text=read(rel)
  for(const old of ['复制商品链接','复制邀请链接','复制推广链接','浏览器不能获取小程序的微信登录凭证','网页暂不支持微信支付','请在微信小程序中登录','请在微信小程序中完成支付'])assert.equal(text.includes(old),false,rel+' 还有旧文字：'+old)
 }
})
