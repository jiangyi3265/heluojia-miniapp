<template><view class="import"><view class="card"><text class="heading">Excel 批量采购</text><view>1. 下载清单，只填写“采购数量”。</view><view>2. 上传文件，核对商品、数量和价格。</view><view>3. 加入采购单，再确认订单与付款。</view><button class="ui-button" :disabled="busy" @click="download">下载采购模板</button><button class="ui-button" :disabled="busy||!!attempt" @click="choose">上传填好的 Excel</button><text class="hint">支持xlsx，最多100种商品。不填写或填0的商品不会加入。</text></view><view v-if="preview" class="card"><view v-if="cartNotice" class="import-notice"><text>{{cartNotice}}</text><template v-if="cart&&mergeState!=='ready'"><text class="hint">当前采购单：</text><view v-for="i in cart.items" :key="i.id">{{i.name||'商品 '+i.id}} × {{i.quantity}}</view><text v-if="!cart.items.length" class="hint">当前采购单为空。</text></template><template v-if="mergeState==='ambiguous'"><button class="ui-button" :disabled="busy" @click="resolveImport('accept')">导入数量已包含在采购单中，结束导入</button><button class="ui-button" :disabled="busy" @click="resolveImport('retry')">尚未包含导入数量，重新核对后加入</button></template></view><view v-for="(e,i) in preview.errors" :key="i" class="error">{{e}}</view><view v-if="preview.errors.length" class="hint">请修改以上问题后重新上传，不会自动忽略错误行。</view><view v-for="p in preview.items" :key="p.id" class="line"><view>{{p.name}} {{p.spec}}</view><view>{{p.quantity}}件 × ¥{{money(p.price)}} · {{p.basis}}</view></view><view v-if="!preview.items.length">清单为空，请填写需要采购的数量。</view><button class="ui-button" :disabled="busy||!preview.items.length||preview.errors.length>0" @click="confirm">{{['unknown','ambiguous'].includes(mergeState)?'重新核对导入结果':mergeState==='refresh'?'重新读取采购单':mergeState==='review'?'核对后重新加入采购单':'将清单加入采购单'}}</button><text class="hint">已有相同商品会合并数量；加入采购单不会扣款或占用库存。</text></view></view></template>
<script>
import {request,money,notify,API_BASE,getToken,go} from '../services/shop'
export default {data(){return{busy:false,preview:null,cart:null,mergeState:'ready',cartNotice:'',attempt:null,previewToken:''}},methods:{money,async download(){this.busy=true;try{const url=API_BASE+'/shop/app/procurement/template',header={'X-Shop-Token':'Bearer '+getToken()};
// #ifdef H5
const r=await fetch(url,{headers:header});if(!r.ok||!r.headers.get('content-type')?.includes('spreadsheetml'))throw Error('模板下载失败，请确认有企业采购权限');const href=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=href;a.download='采购清单.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
// #endif
// #ifndef H5
await new Promise((resolve,reject)=>uni.downloadFile({url,header,success:r=>{if(r.statusCode!==200)return reject(Error('下载失败'));uni.openDocument({filePath:r.tempFilePath,fileType:'xlsx',showMenu:true,success:resolve,fail:()=>reject(Error('打开文件失败'))})},fail:()=>reject(Error('下载失败'))}));
// #endif
}catch(e){notify(e)}finally{this.busy=false}},choose(){
// #ifdef H5
const input=document.createElement('input');input.type='file';input.accept='.xlsx';input.onchange=()=>{if(input.files?.[0])this.upload(input.files[0])};input.click();
// #endif
// #ifdef MP-WEIXIN
uni.chooseMessageFile({count:1,type:'file',extension:['xlsx'],success:r=>this.upload(r.tempFiles[0].path)});
// #endif
},async upload(file){if(this.busy)return;if(this.attempt)return notify('请先核对上次导入结果，再上传新清单');this.busy=true;this.preview=null;this.mergeState='ready';this.cartNotice='';this.previewToken=getToken();try{this.ensureSession();this.cart=await request('/cart/B');this.ensureSession();const url=API_BASE+'/shop/app/procurement/preview',header={'X-Shop-Token':'Bearer '+getToken()};let response;
// #ifdef H5
const form=new FormData();form.append('file',file);response=await(await fetch(url,{method:'POST',headers:header,body:form})).json();
// #endif
// #ifndef H5
response=await new Promise((resolve,reject)=>uni.uploadFile({url,filePath:file,name:'file',header,success:r=>{try{resolve(JSON.parse(r.data))}catch{reject(Error('无法识别表格'))}},fail:()=>reject(Error('上传失败'))}));
// #endif
if(response.code!==200)throw Error(response.msg);this.ensureSession();this.preview=response.data;}catch(e){notify(e)}finally{this.busy=false}},sameCart(a,b){const values=items=>items.map(i=>[Number(i.id),Number(i.quantity),i.checked!==false]).sort((x,y)=>x[0]-y[0]);return JSON.stringify(values(a))===JSON.stringify(values(b))},
 ensureSession(){if(!this.previewToken||this.previewToken!==getToken())throw Error('登录状态已变更，请重新打开导入页面')},
 finishImport(cart){this.ensureSession();this.cart=cart;this.preview=null;this.attempt=null;this.mergeState='ready';this.cartNotice='';go('cart',{channel:'B'})},
 async refreshCart(){
  this.mergeState='refresh';
  try{this.ensureSession();const remote=await request('/cart/B');this.ensureSession();this.cart=remote;this.mergeState='review';this.cartNotice='已重新读取采购单，导入清单仍保留。请核对当前数量，再次确认后将累加导入数量。'}
  catch(e){this.cartNotice='采购单暂未刷新，导入清单仍保留。'+e.message;notify(e)}
 },
 async recoverImport(){
  if(!this.attempt)return this.refreshCart();
  this.attempt.retryReady=false;
  try{this.ensureSession();const remote=await request('/cart/B');this.ensureSession();this.cart=remote;
   if(remote.revision>this.attempt.revision&&this.sameCart(remote.items,this.attempt.items)){this.finishImport(remote);return}
   if(remote.revision===this.attempt.revision){this.attempt.retryReady=true;this.mergeState='review';this.cartNotice='当前采购单尚未显示本次导入。清单仍保留，请核对后重试；会先保留原提交内容，避免重复累加。';return}
   this.mergeState='ambiguous';this.cartNotice='采购单已有其他更新，暂不能确认上次导入是否完成。请核对当前数量和下方导入清单，选择是否已经包含导入数量；不会自动再次累加。';
  }catch(e){this.cartNotice='上次导入结果暂未确认，清单已保留。请重新核对结果，避免重复加入。'+e.message;notify(e)}
 },
 async resolveImport(action){
  if(this.busy||this.mergeState!=='ambiguous')return;this.busy=true;
  try{this.ensureSession();if(action==='accept')this.finishImport(this.cart);else if(action==='retry'){this.attempt=null;await this.refreshCart()}}
  catch(e){notify(e)}
  finally{this.busy=false}
 },
 async confirm(){
  if(this.busy||!this.preview||!this.preview.items.length||this.preview.errors.length)return;this.busy=true;
  try{
   this.ensureSession();
   if(this.attempt&&!this.attempt.retryReady){await this.recoverImport();return}
   if(this.mergeState==='refresh'||!this.cart){await this.refreshCart();return}
   const items=this.cart.items.map(i=>({...i}));
   for(const p of this.preview.items){const old=items.find(i=>Number(i.id)===Number(p.id));if(old){old.quantity=Number(old.quantity)+Number(p.quantity);old.checked=true}else items.push({id:p.id,quantity:p.quantity,checked:true})}
   const uncertainRetry=!!this.attempt?.retryReady;
   this.attempt={revision:this.cart.revision,items};this.cartNotice='';
   try{const saved=await request('/cart/B','PUT',{items,revision:this.cart.revision});this.finishImport(saved)}
   catch(e){
    if(e.staleSession||this.previewToken!==getToken()){this.cartNotice='登录状态已变更，请重新打开导入页面。';throw e}
    if(/购物车已在其他页面更新/.test(e.message)){if(uncertainRetry){this.mergeState='unknown';await this.recoverImport()}else{this.attempt=null;this.cartNotice='采购单已更新，导入清单仍保留。';await this.refreshCart()}}
    else if(e.uncertain===false&&!uncertainRetry){this.attempt=null;this.mergeState='ready';this.cartNotice=e.message;notify(e)}
    else{this.mergeState='unknown';this.cartNotice='上次导入结果暂未确认，清单已保留。'+e.message;notify(e);await this.recoverImport()}
   }
  }catch(e){notify(e)}finally{this.busy=false}
 }
}}
</script><style scoped>
@import '../styles/component-base.css';
.import{padding:16px;font-size:16px}.card{background:var(--shop-surface, #fdfeff);border-radius:12px;padding:16px;margin-bottom:14px;line-height:1.9}.heading{font-size:20px;font-weight:bold}.hint{font-size:14px;color:var(--shop-ink, #28546c);display:block}.line{padding:12px 0;border-bottom:1px solid var(--shop-border, #d5e6ee)}.error{color:#a5342d}.import-notice{padding:12px;background:#f5eee2;border-radius:8px;margin-bottom:16px;font-size:14px;line-height:1.8}button{font-size:16px;background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c);margin:12px 0}</style>
