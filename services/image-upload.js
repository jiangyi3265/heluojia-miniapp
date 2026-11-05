const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Selection's "compressed" hint is not a size guarantee (some phones return the original).
export async function prepareImage(path) {
 if (!path) throw Error('请先选择图片')
 // #ifdef H5
 const source = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(Error('无法读取图片，请选择 JPG 或 PNG 图片')); img.src = path })
 const ratio = Math.min(1, 2000 / Math.max(source.width, source.height))
 const canvas = document.createElement('canvas'); canvas.width = Math.round(source.width * ratio); canvas.height = Math.round(source.height * ratio)
 const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(source, 0, 0, canvas.width, canvas.height)
 const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .85))
 if (!blob || blob.size > MAX_IMAGE_BYTES) throw Error('图片处理后仍超过 5MB，请选择较小图片')
 const url = URL.createObjectURL(blob)
 return {path: url, release: () => URL.revokeObjectURL(url)}
 // #endif
 // #ifndef H5
 const info = await new Promise((resolve, reject) => uni.getImageInfo({src: path, success: resolve, fail: () => reject(Error('无法读取图片，请选择 JPG 或 PNG 图片'))}))
 const ratio = Math.min(1, 2000 / Math.max(info.width, info.height))
 let candidate = path
 for (const quality of [85, 65, 45]) {
  try {
   const result = await new Promise((resolve, reject) => uni.compressImage({src: path, quality, compressedWidth: Math.max(1, Math.round(info.width * ratio)), compressedHeight: Math.max(1, Math.round(info.height * ratio)), success: resolve, fail: reject}))
   candidate = result.tempFilePath
  } catch (_) { /* A valid small original can still be uploaded when compression is unavailable. */ }
  const size = await new Promise((resolve, reject) => uni.getFileInfo({filePath: candidate, success: r => resolve(r.size), fail: () => reject(Error('无法读取所选图片，请重新选择'))}))
  if (size > 0 && size <= MAX_IMAGE_BYTES) return {path: candidate, release() {}}
 }
 throw Error('图片处理后仍超过 5MB，请选择较小图片')
 // #endif
}

export async function uploadImage({path, url, token}) {
 const prepared = await prepareImage(path)
 try {
  return await new Promise((resolve, reject) => uni.uploadFile({url, filePath: prepared.path, name: 'file', timeout: 60000, header: {'X-Shop-Token': 'Bearer ' + token},
   success: r => {
    if (r.statusCode === 413) return reject(Error('图片过大，请重新选择较小图片'))
    // 上传接口用业务码说明登录问题；HTTP 403 只会来自网关或防火墙，会话可能仍然有效，不能说成“登录已过期”。
    if (r.statusCode === 401) return reject(Error('登录已过期，请重新登录后上传'))
    if (r.statusCode === 403) return reject(Error('上传被拒绝，请稍后重试'))
    let body; try { body = typeof r.data === 'string' ? JSON.parse(r.data) : r.data } catch (_) { return reject(Error('上传服务暂时不可用，请重试')) }
    if ((!r.statusCode || r.statusCode === 200) && body?.code === 200) return resolve(body.data)
    reject(Error(body?.msg || '图片上传失败，请重试'))
   }, fail: e => reject(Error(/timeout/i.test(e.errMsg || '') ? '图片上传超时，请重试' : '图片上传失败，请检查网络后重试'))
  }))
 } finally { prepared.release() }
}
