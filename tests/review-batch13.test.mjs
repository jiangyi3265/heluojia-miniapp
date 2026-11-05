import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, existsSync} from 'node:fs'

// 复核第 13 批（顾客端）：服务器时钟、售后进度页过期后的入口、免运费显示。server-clock.js 没有 import，直接按源码加载。
const src = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const load = file => import('data:text/javascript;base64,' + Buffer.from(src('services/' + file)).toString('base64'))
const DAY = 86400000

test('第13批 服务器时钟：按接口响应的 Date 头记下手机与服务器的时差；没读到时用手机时间；坏的或异常的记录不采用', async () => {
  assert.ok(existsSync(new URL('../services/server-clock.js', import.meta.url)), '有 services/server-clock.js')
  const {noteServerDate, serverNow, resetServerClock} = await load('server-clock.js')
  resetServerClock()
  assert.equal(serverNow(1000), 1000, '一次也没读到 Date 头：按手机时间')
  const server = Date.UTC(2026, 9, 4, 5, 0, 0) // 服务器 2026-10-04 13:00:00（北京时间）
  const phone = server - 30 * DAY // 手机慢 30 天
  noteServerDate({date: new Date(server).toUTCString()}, phone - 200, phone + 200)
  assert.ok(Math.abs(serverNow(phone) - server - 500) <= 1, '手机慢 30 天时 serverNow 仍是服务器时间（Date 头截掉毫秒，补半秒）')
  noteServerDate({Date: 'not a date'}, phone, phone + 10)
  noteServerDate(null, phone)
  noteServerDate({Date: new Date(server).toUTCString()}, phone + 10, phone)
  assert.ok(Math.abs(serverNow(phone) - server - 500) <= 1, '坏的 Date 头、没有响应头、收到早于发出：都不改原来的时差')
  noteServerDate({DATE: new Date(server + DAY).toUTCString()}, phone, phone)
  assert.ok(Math.abs(serverNow(phone) - server - DAY - 500) <= 1, '响应头名称大小写不同也能读到')
  // 中间有转发服务时两个 Date 头会被拼在一起（验收环境的同源转发就是这样；第一次修复在这里读不到时间）
  noteServerDate({date: new Date(server).toUTCString() + ', ' + new Date(server + 1000).toUTCString()}, phone, phone)
  assert.ok(Math.abs(serverNow(phone) - server - 500) <= 1, '两个 Date 头拼在一起时取第一个')
})

test('第13批 页面按服务器时间判断售后期限、活动是否开始与活动价；每次接口响应都记录 Date 头', () => {
  const shop = src('services/shop.js'), screen = src('components/ShopScreen.vue'), panel = src('components/CampaignPanel.vue')
  assert.match(shop, /noteServerDate\(res\.header,sentAt\)/)
  assert.match(screen, /afterSaleClosed\(o,serverNow\(\)\)/)
  assert.match(screen, /afterSaleClosed\(this\.currentOrder,serverNow\(\)\)/, '售后申请页也按服务器时间（复核第 13 批 P2-1）')
  assert.doesNotMatch(screen, /afterSaleClosed\([^,()]*\)/, '全文件没有按手机时间判断售后期限的单参数调用')
  assert.match(shop, /try\{noteServerDate\(res\.header,sentAt\)\}catch\(e\)/, '记录服务器时间出错也不影响接口结果')
  assert.match(screen, /priceOffers\(got\.value,serverNow\(\)\)/)
  assert.match(panel, /beijingTime\(c\.starts_at\)<=serverNow\(\)/)
})

test('第13批 售后进度页：已驳回、且订单已过期限的申请（新版与旧版）不显示“修改并重新申请”，改为联系客服；优先用服务器随记录下发的订单收货信息，旧后端时读订单、读失败按未过期处理', () => {
  const screen = src('components/ShopScreen.vue')
  assert.match(screen, /reapplyClosed\(row\)\{/)
  assert.equal((screen.match(/v-if="!reapplyClosed\((c|a)\)"/g) || []).length, 2, '新版与旧版两处都按期限决定')
  assert.ok(screen.includes("('order_received_at' in row)?{received_at:row.order_received_at,rules_json:row.order_rules_json,manual_after_sale_until:row.order_manual_after_sale_until}"), '服务器下发了订单收货信息就直接用')
  assert.ok(screen.includes("x.status==='rejected'&&!('order_received_at' in x)"), '只有旧后端（没有这些字段）时才读订单')
  assert.ok(screen.includes("catch(e){if(e&&(e.staleSession||e.superseded))throw e;this.orders=[]}"), '读订单失败不整页报错')
})

test('第13批 运费说法：自提不显示运费行；快递/同城为 0 写“免运费”；物流配送为 0 照写 ¥0.00；结算页、订单详情、配送卡同一说法；再买一次时下架商品写“已下架或暂不可售”', async () => {
  const {shippingText} = await load('display.js')
  assert.equal(shippingText(0, 'express'), '免运费')
  assert.equal(shippingText(0, 'local'), '免运费')
  assert.equal(shippingText(0, undefined), '免运费', '没有配送记录的旧订单按快递')
  assert.equal(shippingText(0, 'freight'), '¥0.00', '物流配送为 0 可能是运费到付')
  assert.equal(shippingText(0, 'pickup'), '', '自提不显示运费行')
  assert.equal(shippingText(1000, 'pickup'), '')
  assert.equal(shippingText(1250, 'express'), '¥12.50')
  assert.equal(shippingText(undefined, 'express'), '', '读不到金额不显示')
  assert.equal(shippingText(null, 'express'), '')
  const screen = src('components/ShopScreen.vue'), delivery = src('components/DeliveryPanel.vue')
  assert.ok(screen.includes('shippingText(currentOrder.shipping_amount,currentOrder.delivery_method)'), '订单详情金额卡')
  assert.ok(screen.includes('shippingText(quote.shippingFee,deliveryMethod)'), '结算页')
  assert.ok(delivery.includes('deliveryLine(data)') && delivery.includes('shippingText(d.fee,d.method)'), '配送卡')
  assert.ok(delivery.includes("if(d.fee===undefined||d.fee===null)return name"), '配送卡读不到运费时只写配送方式')
  assert.ok(screen.includes("'该商品已下架或暂不可售'") && screen.includes('{{againPriceText(i)}}'), '再买一次的下架商品')
})
