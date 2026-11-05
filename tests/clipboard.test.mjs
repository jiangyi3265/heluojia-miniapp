import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync(new URL('../services/clipboard.js',import.meta.url),'utf8').replaceAll('export ','')
function fixture(write){
 const calls=[],toasts=[],fallback=[]
 const uni={setClipboardData:options=>{calls.push(options);write(options)},showToast:options=>toasts.push(options)}
 const {copyText}=new Function('uni',source+';return {copyText}')(uni)
 return {copy:value=>copyText(value,{onFallback:text=>fallback.push(text)}),copyText,calls,toasts,fallback,uni}
}

test('剪贴板调用直接发生在点击调用栈内，成功后才提示已复制',async()=>{
 let complete
 const f=fixture(options=>{complete=options.success})
 const pending=f.copy('https://example.test/?referrer=31')
 assert.equal(f.calls.length,1)
 assert.equal(f.toasts.length,0)
 complete()
 assert.equal(await pending,true)
 assert.deepEqual(f.fallback,[''])
 assert.equal(f.toasts[0].title,'已复制')
})

test('空内容和非文本不清空用户原剪贴板',async()=>{
 const f=fixture(()=>assert.fail('不应调用剪贴板'))
 for(const value of ['',null,undefined,'  \n  ',{},[],NaN])assert.equal(await f.copy(value),false)
 assert.equal(f.calls.length,0)
 assert.ok(f.toasts.every(t=>t.title==='暂无可复制的内容'&&t.icon==='none'))
})

test('失败保留原文、换行和完整推广参数，供手动复制',async()=>{
 const text='  推荐文案\nhttps://example.test/?id=1001&referrer=31  '
 const f=fixture(options=>options.fail({errMsg:'setClipboardData:fail denied'}))
 assert.equal(await f.copy(text),false)
 assert.equal(f.calls[0].data,text)
 assert.deepEqual(f.fallback,['',text])
 assert.equal(f.toasts[0].icon,'none')
 assert.match(f.toasts[0].title,/手动复制/)
})

test('商家隐私声明缺失时不提示用户去开启不存在的授权',async()=>{
 const f=fixture(options=>options.fail({errMsg:'setClipboardData:fail api scope is not declared in the privacy agreement'}))
 assert.equal(await f.copy('邀请码 31'),false)
 assert.match(f.toasts[0].title,/复制服务暂未开通/)
 assert.doesNotMatch(f.toasts[0].title,/授权|设置|权限/)
 assert.equal(f.fallback.at(-1),'邀请码 31')
})

test('原生接口不存在或同步抛错也显示手动复制，不出现未捕获错误',async()=>{
 const f=fixture(()=>{throw Error('unsupported')})
 assert.equal(await f.copy('test'),false)
 delete f.uni.setClipboardData
 assert.equal(await f.copy('retry'),false)
 assert.equal(f.fallback.at(-1),'retry')
})

test('重新点击可重试，成功清除旧兜底，不自动循环调用',async()=>{
 let failed=true
 const f=fixture(options=>failed?options.fail({}):options.success())
 assert.equal(await f.copy('推广链接'),false)
 assert.equal(f.calls.length,1)
 failed=false
 assert.equal(await f.copy('推广链接'),true)
 assert.equal(f.calls.length,2)
 assert.equal(f.fallback.at(-1),'')
 assert.equal(f.toasts.at(-1).title,'已复制')
})

test('平台重复结束回调只产生一次结果和一次提示',async()=>{
 const f=fixture(options=>{options.success();options.fail({});options.success()})
 assert.equal(await f.copyText(31,{successText:'邀请码已复制'}),true)
 assert.equal(f.calls[0].data,'31')
 assert.equal(f.toasts.length,1)
 assert.equal(f.toasts[0].title,'邀请码已复制')
})
