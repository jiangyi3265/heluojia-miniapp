// 售后申请期限（复核 FC-38）：与服务器 ShopWorkflow.checkApplicationWindow 同一规则——
// 已确认收货的订单，收货后按下单时记下的“售后天数”（订单规则 loyalty.afterSaleDays；订单规则里没有 loyalty 时按 15 天）内可以直接申请；
// 客服人工延长的期限没到之前也可以；还没确认收货的订单不受期限限制。过了期限页面不再显示“申请售后”，改为请顾客联系客服。
const DAY = 86400000

// 服务器给的是北京时间（“2026-10-01 12:00:00”或不带时区的 ISO），按北京时间解析
export function beijingTime(value) {
  if (!value) return NaN
  const raw = String(value).trim()
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) ? raw.replace(' ', 'T') + '+08:00' : raw
  return new Date(normalized).getTime()
}

function orderRules(order) {
  const value = order && order.rules_json
  if (value && typeof value === 'object') return value
  try { return JSON.parse(value || '{}') || {} } catch { return {} }
}

export function afterSaleDays(order) {
  const loyalty = orderRules(order).loyalty
  return loyalty == null ? 15 : (Number(loyalty.afterSaleDays) || 0)
}

export function afterSaleClosed(order, now = Date.now()) {
  if (!order || !order.received_at) return false
  const received = beijingTime(order.received_at)
  if (!Number.isFinite(received)) return false
  const manual = beijingTime(order.manual_after_sale_until)
  if (Number.isFinite(manual) && manual >= now) return false
  return now - received > afterSaleDays(order) * DAY
}
