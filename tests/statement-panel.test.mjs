import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// Runs the real StatementPanel.vue (历史企业“企业对账”) script. Cash rows come from ShopStatement as
// <付款渠道>_<payment|refund> (shop_payment.mode: wechat / wallet / rebate / points_exchange / bank_transfer / simulation)
// and occurred_at arrives like 2026-09-05T17:50:03.
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const {formatDate}=await import('data:text/javascript;base64,'+Buffer.from(read('../services/display.js')).toString('base64'))
const source=read('../components/StatementPanel.vue')
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .+$/gm,'').replace('export default','return')
const deps={refreshOnTick:()=>({}),request:async()=>({}),money:x=>(Number(x||0)/100).toFixed(2),notify(){},API_BASE:'',getToken:()=>'',formatDate}
const component=Function(...Object.keys(deps),script)(...Object.values(deps))
const vm={...component.data()};for(const [name,method] of Object.entries(component.methods))vm[name]=typeof method==='function'?method.bind(vm):method

test('对账明细的付款渠道都显示中文，不出现英文代码',()=>{
 for(const mode of ['wechat','wallet','rebate','points_exchange','bank_transfer','simulation'])for(const kind of ['payment','refund']){
  const name=vm.kindName(mode+'_'+kind)
  assert.doesNotMatch(name,/[a-z_]/,mode+'_'+kind)
  assert.match(name,kind==='payment'?/付款|记录/:/退款/)
 }
 assert.equal(vm.kindName('wechat_payment'),'微信订单付款')
 assert.equal(vm.kindName('wallet_payment'),'余额订单付款')
 assert.equal(vm.kindName('repayment'),'核销还款')
 assert.equal(vm.kindName('bank_received'),'银行实际收款核验')
})

test('没见过的代码兜底显示“订单收退款”',()=>{
 assert.equal(vm.kindName('newpay_payment'),'订单收退款')
 assert.equal(vm.kindName(undefined),'订单收退款')
})

test('明细时间用统一格式显示，不带“T”',()=>{
 assert.equal(vm.formatDate('2026-09-05T17:50:03'),'2026-09-05 17:50')
 assert.match(source,/\{\{formatDate\(r\.occurred_at\)\}\}/)
 assert.match(source,/\{\{kindName\(r\.kind\)\}\}/)
})
