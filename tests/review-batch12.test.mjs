import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// 复核第 12 批（顾客端）：售后期限、活动价、下载出错原因、北京时间换算。这几个文件都没有 import，直接按源码加载。
const load = file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../services/' + file, import.meta.url), 'utf8')).toString('base64'))
const {afterSaleClosed, afterSaleDays, beijingTime} = await load('after-sale-window.js')
const {priceOffers, offerFor} = await load('campaign-price.js')
const {serverReason, isImageResponse} = await load('download-reason.js')
const display = await load('display.js')

const DAY = 86400000
// 北京时间 2026-10-20 12:00:00
const NOW = Date.UTC(2026, 9, 20, 4, 0, 0)
const daysAgo = n => { const d = new Date(NOW - n * DAY + 8 * 3600000); const p = x => String(x).padStart(2, '0'); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00` }

test('FC-38 售后期限：与服务器同一规则（收货后按下单时的售后天数，缺省 15 天；人工延期内可申请；未收货不受限）', () => {
  const rules = JSON.stringify({loyalty: {afterSaleDays: 15}})
  assert.equal(beijingTime('2026-10-20 12:00:00'), NOW)
  assert.equal(afterSaleClosed({received_at: daysAgo(20), rules_json: rules}, NOW), true, '收货 20 天、期限 15 天：已过期')
  assert.equal(afterSaleClosed({received_at: daysAgo(10), rules_json: rules}, NOW), false, '收货 10 天：还能申请')
  assert.equal(afterSaleClosed({received_at: daysAgo(20), rules_json: rules, manual_after_sale_until: daysAgo(-2)}, NOW), false, '客服延期到 2 天后：还能申请')
  assert.equal(afterSaleClosed({received_at: daysAgo(20), rules_json: rules, manual_after_sale_until: daysAgo(1)}, NOW), true, '延期已过：过期')
  assert.equal(afterSaleClosed({received_at: null, rules_json: rules}, NOW), false, '还没收货：不受期限限制')
  assert.equal(afterSaleDays({rules_json: '{}'}), 15, '订单规则里没有 loyalty：按 15 天')
  assert.equal(afterSaleClosed({received_at: daysAgo(16), rules_json: '{}'}, NOW), true)
  assert.equal(afterSaleDays({rules_json: JSON.stringify({loyalty: {afterSaleDays: 30}})}), 30)
  assert.equal(afterSaleClosed({received_at: daysAgo(20), rules_json: {loyalty: {afterSaleDays: 30}}}, NOW), false, '下单时是 30 天：还能申请')
})

test('FC-15 活动价：只算已开始、未结束的“活动价”活动；人人可享的价与限首单/等级的价分开；页面优先标人人可享的价，只有比显示价低才标', () => {
  const at = n => daysAgo(n)
  const campaigns = [
    // 与小程序活动接口一致：规则在 config_json（文字）里
    {id: 1, kind: 'price', status: 'active', starts_at: at(1), ends_at: at(-3), config_json: JSON.stringify({items: [{productId: 7, price: 8000}, {productId: 8, price: 5000}]})},
    {id: 2, kind: 'price', status: 'active', starts_at: at(1), ends_at: at(-3), config_json: JSON.stringify({firstOnly: true, items: [{productId: 7, price: 7000}, {productId: 12, price: 6000}]})},
    {id: 6, kind: 'price', status: 'active', starts_at: at(1), ends_at: at(-3), config_json: JSON.stringify({minimumTier: 2, items: [{productId: 12, price: 5500}]})},
    {id: 3, kind: 'price', status: 'active', starts_at: at(-1), ends_at: at(-3), config: {items: [{productId: 9, price: 100}]}},
    {id: 4, kind: 'price', status: 'active', starts_at: at(5), ends_at: at(1), config: {items: [{productId: 10, price: 100}]}},
    {id: 5, kind: 'flash', status: 'active', starts_at: at(1), ends_at: at(-3), config: {items: [{productId: 11, price: 100}]}},
  ]
  const offers = priceOffers(campaigns, NOW)
  assert.deepEqual(offers[7], {open: 8000, conditional: 7000}, '人人可享 80 元、限首单 70 元分开记')
  assert.deepEqual(offerFor(offers, {id: 7}, 10000), {price: 8000, conditional: false}, '页面承诺人人可享的 80 元，不承诺老顾客拿不到的 70 元')
  assert.deepEqual(offerFor(offers, {id: 12}, 9000), {price: 5500, conditional: true}, '只有限条件的活动价：标出并注明有条件（两个限条件活动取低者）')
  assert.deepEqual(offerFor(offers, {id: 7}, 7500), {price: 7000, conditional: true}, '人人可享的价不比显示价低时，再看限条件的价')
  assert.deepEqual(offerFor(offers, {id: 8}, 12800), {price: 5000, conditional: false})
  assert.equal(offerFor(offers, {id: 8}, 4000), null, '显示价已经更低（如充值折扣价）时不再标活动价')
  assert.equal(offers[9], undefined, '还没开始的不算')
  assert.equal(offers[10], undefined, '已结束的不算')
  assert.equal(offers[11], undefined, '秒杀要单独下单，不算“结算自动按活动价”')
  assert.equal(offerFor(offers, {id: 99}, 12800), null)
  assert.deepEqual(priceOffers(null, NOW), {})
})

test('FC-17 下载出错：取出服务器说明的原因；登录过期另行提示；不是图片的响应按出错处理', () => {
  assert.equal(serverReason('{"code":500,"msg":"素材图片不存在，请联系商家更新"}', '海报暂时生成不了'), '素材图片不存在，请联系商家更新')
  assert.equal(serverReason('{"code":401,"msg":"认证失败"}', 'x'), '登录状态已过期，请重新登录后再试')
  assert.equal(serverReason('<html>bad gateway</html>', '海报暂时生成不了'), '海报暂时生成不了')
  assert.equal(serverReason('', '海报暂时生成不了'), '海报暂时生成不了')
  assert.equal(isImageResponse({'Content-Type': 'image/png'}), true)
  assert.equal(isImageResponse({'content-type': 'application/json;charset=UTF-8'}), false)
  assert.equal(isImageResponse({}), true, '没有类型时按原来的做法当作图片（小程序下载结果不带响应头，另用“能否读成图片”判断）')
})

test('活动“进行中/尚未开始”按北京时间判断：服务器给的时间按北京时间换算，与手机所在时区无关', () => {
  assert.equal(display.beijingTime('2026-10-20 12:00:00'), NOW)
  assert.equal(display.beijingTime('2026-10-20T12:00:00'), NOW)
  assert.equal(display.beijingTime('2026-10-20T04:00:00Z'), NOW, '带时区的照原样')
  assert.ok(Number.isNaN(display.beijingTime('')))
})
