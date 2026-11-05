// New business purchases use the reviewed distributor account. Historical
// order, after-sales, payment and invoice routes retain their original channel.
export function purchaseEntry(screen, query = {}) {
  const legacyEntry = ['business', 'enterprise-apply', 'procurement-import'].includes(screen)
  const legacyCatalog = query.channel === 'B' && ['index', 'category', 'search', 'product', 'cart', 'checkout', 'promote', 'campaigns'].includes(screen)
  if (legacyEntry || legacyCatalog) return {screen:'partner', query:{}}
  return {screen, query}
}
