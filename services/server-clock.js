// 服务器时钟（复核第 13 批）：页面上“是否已过售后期限”“活动是否已开始”“活动价”这类判断按服务器时间算，
// 手机时间不准（比如慢了几天）时也和服务器一致。每次接口响应都带 Date 头（精确到秒），记下“服务器时间 − 手机时间”的差；
// 一次也没读到（比如网页版跨域时浏览器不给 Date 头）就按手机时间。
let offset = null

export function noteServerDate(header, sentAt, receivedAt = Date.now()) {
  if (!header || typeof header !== 'object') return
  const key = Object.keys(header).find(k => k.toLowerCase() === 'date')
  // 中间有转发服务时可能带两个 Date 头，浏览器会拼成“日期, 日期”：取第一个完整的日期
  const raw = key ? String(header[key]) : ''
  const first = raw.match(/[A-Za-z]{3}, \d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT/)
  const server = Date.parse(first ? first[0] : raw)
  if (!Number.isFinite(server) || !Number.isFinite(sentAt) || receivedAt < sentAt) return
  // Date 头是服务器处理请求时的那一秒（截掉了毫秒）：按请求往返的中点对齐，再补半秒
  offset = server + 500 - (sentAt + receivedAt) / 2
}

export function serverNow(local = Date.now()) {
  return offset == null ? local : local + offset
}

export function resetServerClock() {
  offset = null
}
