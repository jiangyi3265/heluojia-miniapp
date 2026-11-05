<template><view class="card"><button class="ui-button" :disabled="busy" @click="download">下载采购单（可打印）</button><text>按本订单保存的商品和金额生成，非发票。</text></view></template><script>import {API_BASE,getToken,notify} from '../services/shop.js';export default {props:{orderId:{required:true}},data(){return{busy:false}},methods:{async download(){if(this.busy)return;this.busy=true;try{const url=API_BASE+'/shop/app/procurement/orders/'+this.orderId+'/document',header={'X-Shop-Token':'Bearer '+getToken()};
// #ifdef H5
const r=await fetch(url,{headers:header});if(!r.ok||r.headers.get('content-type')?.includes('json'))throw Error('采购单下载失败');const href=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=href;a.download='采购单-'+this.orderId+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
// #endif
// #ifndef H5
await new Promise((resolve,reject)=>uni.downloadFile({url,header,success:r=>{if(r.statusCode!==200)return reject(Error('下载失败'));uni.openDocument({filePath:r.tempFilePath,fileType:'xlsx',showMenu:true,success:resolve,fail:()=>reject(Error('无法打开采购单'))})},fail:()=>reject(Error('下载失败，请重试'))}));
// #endif
}catch(e){notify(e)}finally{this.busy=false}}}}</script><style scoped>
@import '../styles/component-base.css';
.card{background:var(--shop-surface, #fdfeff);margin:16px;padding:16px;border-radius:12px}button{font-size:16px;color:var(--shop-ink, #28546c)}text{font-size:14px;color:var(--shop-ink, #28546c);display:block;margin-top:12px}</style>