// Call this directly from the click handler, before any network request or await.
// The native clipboard operation must retain the user's activation on H5/iOS.
export function copyText(value, {onFallback, successText='已复制', emptyText='暂无可复制的内容'}={}) {
 const text=typeof value==='string'?value:typeof value==='number'&&Number.isFinite(value)?String(value):''
 const showFallback=text=>{try{onFallback?.(text)}catch{}}
 const toast=(title,icon='none')=>{try{uni.showToast({title,icon,duration:2500})}catch{}}
 showFallback('')
 if(!text.trim()){toast(emptyText);return Promise.resolve(false)}
 return new Promise(resolve=>{
  let finished=false
  const finish=(success,error)=>{
   if(finished)return
   finished=true
   if(success)toast(successText,'success')
   else{
    showFallback(text)
    const undeclared=/api scope is not declared in the privacy agreement/i.test(String(error?.errMsg||error?.message||''))
    toast(undeclared?'复制服务暂未开通，请先手动复制':'自动复制失败，请长按文字手动复制')
   }
   resolve(success)
  }
  try{
   uni.setClipboardData({data:text,showToast:false,success:()=>finish(true),fail:error=>finish(false,error)})
  }catch(error){finish(false,error)}
 })
}
