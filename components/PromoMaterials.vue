<template><view class="materials"><view class="toolbar"><text class="heading">我的推广素材</text><picker :range="categories" @change="category=categories[Number($event.detail.value)]"><text>{{category}} ▾</text></picker></view><text class="hint" style="margin:0 0 14px">{{linkNote}}</text><view v-if="error" class="card">{{error}}<button class="ui-button" @click="load">重试</button></view><view v-for="m in filtered" :key="m.id" class="card"><image :src="asset(m.image)" mode="widthFix"/><input v-model="drafts[m.id].title" :disabled="!!posterBusy[m.id]" class="title-editor" maxlength="80" placeholder="分享标题"/><textarea v-model="drafts[m.id].copyText" :disabled="!!posterBusy[m.id]" maxlength="2000" auto-height class="copy-editor" placeholder="写下你的推荐理由"/><view class="editor-actions"><text>{{dirty(m)?'有未保存修改':'已同步至账号'}}</text><button class="ui-button" :disabled="!!saving[m.id]||!!posterBusy[m.id]||!dirty(m)" @click="save(m)">{{saving[m.id]?'保存中':'保存文案'}}</button></view><text v-if="m.target==='product'" class="commission">{{m.estimatedCommission>0?'每件预计佣金 ¥'+money(m.estimatedCommission)+'（按商品标价估算，实际按客户实付计算）':'这件商品目前没有推广佣金'}}</text><view class="actions"><button class="ui-button" :disabled="copying" @click="copy(drafts[m.id].copyText)">复制文案</button><button class="ui-button" :disabled="copying" @click="copy(m.link)">复制网页链接</button></view><!-- #ifdef MP-WEIXIN --><button class="ui-button" open-type="share" :data-share-kind="m.target==='recruit'?'recruit':'product'" :data-product-id="m.product_id" :data-share-title="drafts[m.id].title" :data-channel="m.channel">分享给微信好友</button><!-- #endif --><view class="actions"><button class="ui-button" @click="download(asset(m.image),false)">下载原图</button><button class="ui-button" :disabled="!!saving[m.id]||!!posterBusy[m.id]" @click="poster(m)">保存我的海报</button></view><text class="hint">邀请码 {{m.invitationCode}} · 佣金以订单实际结算为准</text></view><view v-if="!filtered.length&&!error" class="empty">暂无推广素材</view><CopyFallback :value="copyFallback" :busy="copying" @retry="copy(copyFallback)" @close="copyFallback=''"/></view></template>
<script>
import {request,asset,money,API_BASE,getToken,notify} from '../services/shop'
import {copyText} from '../services/clipboard'
import {serverReason,isImageResponse} from '../services/download-reason'
import {copyLinkNote} from '../services/h5-guide'
import CopyFallback from './CopyFallback.vue'
export default {components:{CopyFallback},props:{refreshTick:{default:0},shopName:{type:String,default:''}},data(){return{rows:[],drafts:{},copyFallback:'',copying:false,category:'全部',error:'',saving:{},posterBusy:{},loadVersion:0,loading:false,refreshPending:false}},computed:{linkNote(){return copyLinkNote(this.shopName,'promoter')},categories(){return['全部',...new Set(this.rows.map(r=>r.category))]},filtered(){return this.rows.filter(r=>this.category==='全部'||r.category===this.category)}},mounted(){this.load()},watch:{refreshTick(){this.load()}},methods:{asset,money,
 async load(){
  if(this.hasPendingSave()){this.refreshPending=true;return}
  this.refreshPending=false;this.loading=true;const version=++this.loadVersion;
  try{const rows=await request('/promo-materials');if(version!==this.loadVersion)return;
   const drafts={...this.drafts};
   for(const m of rows){const previous=this.rows.find(row=>row.id===m.id);if(!previous||!this.dirty(previous))drafts[m.id]={title:m.title,copyText:m.copy_text,revision:m.draftRevision||0}}
   this.drafts=drafts;this.rows=rows;if(!this.categories.includes(this.category))this.category='全部';this.error='';
  }catch(e){if(version===this.loadVersion)this.error=e.message}finally{if(version===this.loadVersion)this.loading=false}
 },
 hasPendingSave(){return Object.values(this.saving).some(Boolean)||Object.values(this.posterBusy).some(Boolean)},
 invalidateLoad(){if(this.loading){this.refreshPending=true;this.loading=false}this.loadVersion++},
 refreshAfterSave(){if(this.refreshPending&&!this.hasPendingSave())this.load()},
 dirty(m){const d=this.drafts[m.id];return !!d&&(d.title!==m.title||d.copyText!==m.copy_text)},
 async save(m,forPoster=false){
  if(this.saving[m.id]||this.posterBusy[m.id]&&!forPoster)return false;
  const row=this.rows.find(item=>item.id===m.id)||m;if(!this.dirty(row))return true;
  const submitted={...this.drafts[m.id]};this.saving[m.id]=true;this.invalidateLoad();
  try{const saved=await request('/promo-materials/'+m.id+'/draft','POST',submitted),current=this.drafts[m.id];
   this.drafts[m.id]={title:current.title===submitted.title?saved.title:current.title,copyText:current.copyText===submitted.copyText?saved.copyText:current.copyText,revision:saved.revision};
   row.title=saved.title;row.copy_text=saved.copyText;row.draftRevision=saved.revision;
   const changed=this.dirty(row);uni.showToast({title:changed?'已保存，新修改待保存':'文案已保存',icon:changed?'none':'success'});return true;
  }catch(e){notify(e);return false}finally{this.saving[m.id]=false;this.refreshAfterSave()}
 },
 async copy(text){if(this.copying)return;this.copying=true;try{return await copyText(text,{onFallback:value=>{this.copyFallback=value}})}finally{this.copying=false}},async poster(m){
  if(this.saving[m.id]||this.posterBusy[m.id])return;
  this.posterBusy[m.id]=true;this.invalidateLoad();
  try{if(!await this.save(m,true))return;if(this.dirty(this.rows.find(row=>row.id===m.id)||m)){notify('文案有新修改，请保存后再生成海报');return}await this.download(API_BASE+'/shop/app/promo-materials/'+m.id+'/poster',true)}
  finally{this.posterBusy[m.id]=false;this.refreshAfterSave()}
 },
 async download(url,privateFile){try{
 // #ifdef H5
 const r=await fetch(url,{headers:privateFile?{'X-Shop-Token':'Bearer '+getToken()}:{}});if(!r.ok||!r.headers.get('content-type')?.includes('image'))throw Error(serverReason(await r.text().catch(()=>''),privateFile?'海报暂时生成不了，请稍后重试':'图片暂不可下载，请稍后重试'));const blob=await r.blob(),link=URL.createObjectURL(blob),a=document.createElement('a');a.href=link;a.download=privateFile?'我的推广海报.png':'推广素材.png';a.click();setTimeout(()=>URL.revokeObjectURL(link),1000);
 // #endif
 // #ifdef MP-WEIXIN
 const path=await new Promise((resolve,reject)=>uni.downloadFile({url,header:privateFile?{'X-Shop-Token':'Bearer '+getToken()}:{},success:r=>{const fallback=privateFile?'海报暂时生成不了，请稍后重试':'图片下载失败';const reason=()=>{try{uni.getFileSystemManager().readFile({filePath:r.tempFilePath,encoding:'utf8',success:x=>reject(Error(serverReason(x.data,fallback))),fail:()=>reject(Error(fallback))})}catch(e){reject(Error(fallback))}};if(r.statusCode!==200||!isImageResponse(r.header))return reason();/* 微信的下载结果不带响应头，服务器出错时也是 200 + 一段说明：先确认下到的确实是图片，不是就读出说明（复核） */uni.getImageInfo({src:r.tempFilePath,success:()=>resolve(r.tempFilePath),fail:reason})},fail:()=>reject(Error('图片下载失败'))}));await new Promise((resolve,reject)=>uni.saveImageToPhotosAlbum({filePath:path,success:resolve,fail:()=>reject(Error('未保存图片，请允许保存到相册后重试'))}));uni.showToast({title:'已保存到相册'});
 // #endif
 }catch(e){notify(e)}}}}
</script>
<style scoped>
@import '../styles/component-base.css';
.materials{padding:16px;color:var(--shop-text, #2b424f);font-size:14px}.toolbar,.editor-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.heading{font-size:20px;font-weight:600}.card{background:var(--shop-surface, #fdfeff);border-radius:14px;padding:16px;margin-bottom:18px}.card image{width:100%;border-radius:10px}.title-editor{height:44px;font-size:17px;font-weight:600;margin-top:12px;width:100%;box-sizing:border-box}.copy-editor{width:100%;min-height:88px;line-height:1.8;font-size:14px;background:var(--shop-background, #f3f8fb);border-radius:8px;padding:12px;box-sizing:border-box;margin:8px 0}.editor-actions{font-size:11px;color:var(--shop-muted, #59727f)}.editor-actions button{font-size:12px;padding:0 14px;line-height:32px;margin:0}.commission{display:block;color:#ae714b;margin:12px 0}.actions{display:flex;gap:10px}.actions button{flex:1;background:var(--shop-soft, #eaf5fb);color:var(--shop-ink, #28546c)}.card button{font-size:13px;line-height:40px;margin-top:10px;background:var(--shop-accent, #c7e8f5);color:var(--shop-ink, #28546c)}.card button[disabled]{background:var(--shop-soft, #eaf5fb);color:var(--shop-muted, #59727f)}.hint{display:block;font-size:11px;color:var(--shop-muted, #59727f);line-height:1.6;margin-top:14px}.empty{text-align:center;padding:40px;color:var(--shop-muted, #59727f)}</style>
