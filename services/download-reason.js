// 下载图片、生成海报时，服务器出错返回的是一段说明（JSON），不是图片（复核 FC-17）：
// 取出其中的原因给用户看（例如“素材图片不存在，请联系商家更新”），而不是一律提示“请允许保存到相册”。
export function serverReason(text, fallback) {
  let body = null
  try { body = JSON.parse(String(text || '')) } catch { body = null }
  if (body && Number(body.code) === 401) return '登录状态已过期，请重新登录后再试'
  const message = body && typeof body.msg === 'string' ? body.msg.trim() : ''
  return message || fallback
}

// 小程序下载结果的响应头：明确不是图片（例如 application/json）时按出错处理；没有类型时按原来的做法当作图片
export function isImageResponse(header) {
  const h = header || {}
  const type = String(h['Content-Type'] || h['content-type'] || '').toLowerCase()
  return !type || type.startsWith('image/')
}
