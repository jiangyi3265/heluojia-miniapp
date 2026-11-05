// 活动价（复核 FC-15）：结算时服务器会自动按“活动价”活动降价（ShopMarketing.price：只算已开始、未结束的“活动价”活动，按顾客资格取最低价），
// 但商品页、分类、购物车原来只显示原价。这里按活动列表算出每件商品的活动价，页面标出“活动价 ¥X，以结算为准”。
// 人人都能享受的活动价和“限首单/会员等级”的活动价分开算（复核）：页面优先承诺人人都能享受的价；只有限条件的价更低时，
// 才标出它并注明“限符合活动条件的顾客”（资格由服务器在结算时判断）。
function beijingTime(value) {
  if (!value) return NaN
  const raw = String(value).trim()
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) ? raw.replace(' ', 'T') + '+08:00' : raw
  return new Date(normalized).getTime()
}

// 小程序接口给的是 config_json（文字）；也接受已经解析好的 config
function campaignConfig(campaign) {
  const value = campaign && (campaign.config != null ? campaign.config : campaign.config_json)
  if (value && typeof value === 'object') return value
  try { return JSON.parse(value || '{}') || {} } catch { return {} }
}

// 商品编号 → { open: 人人都能享受的最低活动价（分）或 null, conditional: 限首单/等级的最低活动价或 null }
export function priceOffers(campaigns, now = Date.now()) {
  const offers = {}
  for (const campaign of Array.isArray(campaigns) ? campaigns : []) {
    if (!campaign || campaign.kind !== 'price' || (campaign.status && campaign.status !== 'active')) continue
    const starts = beijingTime(campaign.starts_at), ends = beijingTime(campaign.ends_at)
    if (!(starts <= now && now < ends)) continue
    const config = campaignConfig(campaign)
    const key = config.firstOnly || Number(config.minimumTier) > 0 ? 'conditional' : 'open'
    for (const item of Array.isArray(config.items) ? config.items : []) {
      const id = Number(item && item.productId), price = Number(item && item.price)
      if (!id || !Number.isFinite(price) || price < 0) continue
      const offer = offers[id] || (offers[id] = { open: null, conditional: null })
      if (offer[key] == null || price < offer[key]) offer[key] = price
    }
  }
  return offers
}

// 页面上标出的活动价：比显示价低才标；先看人人都能享受的价，没有（或不更低）时再看限条件的价
export function offerFor(offers, product, shownPrice) {
  const offer = offers && product ? offers[Number(product.id)] : null
  const shown = Number(shownPrice)
  if (!offer || !Number.isFinite(shown)) return null
  if (offer.open != null && offer.open < shown) return { price: offer.open, conditional: false }
  if (offer.conditional != null && offer.conditional < shown) return { price: offer.conditional, conditional: true }
  return null
}
