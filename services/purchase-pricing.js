// Prices are supplied by the server for the signed-in account; never calculate entitlements here.
export function displayProducts(products) {
  return products.map(product => ({
    ...product,
    retailPrice: product.price,
    price: product.price,
    purchaseMode: 'standard',
    priceLabel: Number(product.retailRate)>0&&Number(product.retailRate)<10000 ? '充值会员'+Number(product.retailRate)/1000+'折' : ''
  }))
}

// Ordinary browsing never turns eligibility into an instruction to buy at partner prices.
// Accept older drafts only when their request key identifies the dedicated partner page.
export function checkoutPurchaseMode(state, channel = 'C') {
  return channel === 'C' && !state.campaignId && !state.exchange &&
    state.purchaseMode === 'partner' &&
    (state.checkoutSource === 'partner' || String(state.requestKey || '').startsWith('partner_'))
    ? 'partner' : 'standard'
}

export function normalizeCheckoutState(state, channel = 'C', newRequestKey = () => 'order_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)) {
  if (state.purchaseMode === 'partner' && checkoutPurchaseMode(state, channel) !== 'partner') {
    return {...state, purchaseMode: 'standard', requestKey: newRequestKey()}
  }
  return state
}

export function purchaseMode(items, channel = 'C') {
  if (channel !== 'C' || !items.length) return 'standard'
  const partnerCount = items.filter(item => item.purchaseMode === 'partner').length
  if (partnerCount && partnerCount !== items.length) {
    throw Error('拿货商品与不参加拿货的商品需分开结算，请分别勾选后下单')
  }
  return partnerCount ? 'partner' : 'standard'
}

// Only compare price candidates returned for this account. The final quote stays authoritative.
export function purchasePriceInfo(product, quantity) {
  const price = Number(product.wholesale) || 0
  const fallback = {price, basis: product.priceBasis || '采购基础价'}
  if (product.agreementPrice && product.purchasePriority !== 'lowest') return fallback
  const qty = Number(quantity) || Number(product.minimum) || Number(product.pack) || 1
  let best = product.agreementPrice ? fallback : null
  const consider = (value, basis) => {
    const candidate = Number(value)
    if (Number.isFinite(candidate) && candidate > 0 && (!best || candidate < best.price)) {
      best = {price: candidate, basis}
    }
  }
  if (product.gradePrice != null) consider(product.gradePrice, '采购等级价')
  for (const tier of product.tiers || []) {
    if (qty >= Number(tier.quantity)) consider(tier.price, '采购阶梯价')
  }
  return best || fallback
}
