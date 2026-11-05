<template><view v-if="count>0" class="case-proofs"><text class="proofs-title">{{heading||'已上传的图片凭证'}}（{{count}}张）· 点击查看大图</text><view class="proof-row"><view v-for="n in count" :key="n" class="proof-cell" @click="open(n-1)"><image v-if="paths[n-1]" :src="paths[n-1]" mode="aspectFill" class="proof-thumb" @error="broken(n-1)"/><view v-else class="proof-thumb proof-placeholder"><text>{{failed[n-1]?'加载失败':'加载中…'}}</text><text v-if="failed[n-1]" class="retry">点击重试</text></view></view></view></view></template>
<script>
import {API_BASE,getToken} from '../services/shop'
import {caseProofUrl} from '../services/case-proofs'
export default {
 props:{caseId:{type:[Number,String],required:true},count:{type:Number,default:0},staff:{type:Boolean,default:false},proofPath:{type:String,default:''},heading:{type:String,default:''}},
 data(){return {paths:[],failed:[],version:0}},
 watch:{caseId(){this.reset()},count(){this.reset()},staff(){this.reset()},proofPath(){this.reset()}},
 mounted(){this.reset()},
 beforeUnmount(){this.closed=true;this.version++;this.release()},
 methods:{
  forget(path){
   // #ifdef H5
   if(path&&path.startsWith('blob:'))URL.revokeObjectURL(path)
   // #endif
  },
  release(){for(const path of this.paths)this.forget(path);this.paths=[];this.failed=[]},
  reset(){this.version++;this.release();this.paths=Array(this.count).fill('');this.failed=Array(this.count).fill(false);this.loadAll()},
  async loadAll(){const version=this.version;for(let i=0;i<this.count;i++){if(this.closed||version!==this.version)return;await this.loadOne(i,version)}},
  async loadOne(index,version=this.version){
   this.failed.splice(index,1,false)
   const token=getToken(),url=this.proofPath?API_BASE+'/shop/app'+this.proofPath:caseProofUrl(API_BASE,this.caseId,index,this.staff),header={'X-Shop-Token':'Bearer '+token}
   try{
    let path
    // #ifdef H5
    const r=await fetch(url,{headers:header});if(!r.ok||!String(r.headers.get('content-type')||'').includes('image/'))throw Error('图片加载失败');path=URL.createObjectURL(await r.blob());if(this.closed||version!==this.version||token!==getToken()){URL.revokeObjectURL(path);return}
    // #endif
    // #ifndef H5
    path=await new Promise((resolve,reject)=>uni.downloadFile({url,header,success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(Error('图片加载失败')),fail:()=>reject(Error('图片加载失败'))}));if(this.closed||version!==this.version||token!==getToken())return
    // #endif
    this.paths.splice(index,1,path)
   }catch{if(!this.closed&&version===this.version)this.failed.splice(index,1,true)}
  },
  broken(index){this.forget(this.paths[index]);this.paths.splice(index,1,'');this.failed.splice(index,1,true)},
  open(index){const path=this.paths[index];if(!path){if(this.failed[index])this.loadOne(index);return}uni.previewImage({current:path,urls:this.paths.filter(Boolean),fail:()=>uni.showToast({title:'图片暂时无法打开，请稍后重试',icon:'none'})})}
 }
}
</script>
<style scoped>
.case-proofs{margin-top:10px}.proofs-title{display:block;font-size:13px;color:var(--shop-ink, #28546c);line-height:1.7}.proof-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.proof-cell{flex-shrink:0}.proof-thumb{display:block;width:72px;height:72px;border-radius:8px;background:var(--shop-background, #f3f8fb)}.proof-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;border:1px dashed var(--shop-border, #d5e6ee);font-size:12px;line-height:1.5;color:var(--shop-muted, #59727f);text-align:center}.retry{color:var(--shop-ink, #28546c)}
</style>
