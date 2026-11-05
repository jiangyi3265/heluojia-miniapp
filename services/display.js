// Display server instants in the shop's China time zone on every client.
export function formatDate(value) {
 if (!value) return ''
 const raw = String(value).trim()
 const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) ? raw.replace(' ', 'T') + '+08:00' : value
 const time = new Date(normalized).getTime()
 if (!Number.isFinite(time)) return '时间待更新'
 const d = new Date(time + 8 * 60 * 60 * 1000), pad = n => String(n).padStart(2, '0')
 return d.getUTCFullYear() + '-' + pad(d.getUTCMonth()+1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes())
}

// 服务器给的是北京时间（“2026-10-01 12:00:00”或不带时区的 ISO）：换算成时间戳时按北京时间，与手机所在时区无关（复核）
export function beijingTime(value) {
 if (!value) return NaN
 const raw = String(value).trim()
 const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) ? raw.replace(' ', 'T') + '+08:00' : raw
 return new Date(normalized).getTime()
}

// 运费的说法（复核第 13 批）：自提不收运费（返回空，页面不显示运费行）；快递、同城配送运费为 0 写“免运费”；
// 物流配送运费为 0 时可能是运费到付，照写 ¥0.00；读不到金额也返回空。
export function shippingText(amount, method) {
 if (method === 'pickup' || amount === null || amount === undefined || amount === '') return ''
 const fen = Number(amount)
 if (!Number.isFinite(fen)) return ''
 if (fen > 0) return '¥' + (fen / 100).toFixed(2)
 return method === 'freight' ? '¥0.00' : '免运费'
}
