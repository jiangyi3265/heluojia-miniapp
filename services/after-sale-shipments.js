export function refundShipmentNeed(item, quantity, type) {
  if (!['refund', 'return'].includes(type)) return 0
  const count = Math.max(0, Number(quantity) || 0)
  return type === 'refund' ? Math.max(0, count - Math.max(0, Number(item.remaining_to_ship) || 0)) : count
}

export function refundShipmentOptions(item) {
  return (item.refund_shipments || []).filter(p => Number(p.refundable_quantity) > 0)
}

export function needsRefundShipmentChoice(item, quantity, type) {
  if (item.refund_shipment_selection_error) return false
  const needed = refundShipmentNeed(item, quantity, type)
  const options = refundShipmentOptions(item)
  return needed > 0 && options.length > 1 && needed < options.reduce((total, p) => total + Number(p.refundable_quantity), 0)
}

export function refundShipmentPayload(item, quantity, type, selection = {}) {
  const needed = refundShipmentNeed(item, quantity, type)
  if (!needed) return undefined
  // Older refunds did not always identify a parcel. Keep the server's conservative
  // compatibility path rather than inventing a parcel or blocking a valid full refund.
  if (item.refund_shipment_selection_error) return undefined
  if (!needsRefundShipmentChoice(item, quantity, type)) return undefined
  const options = refundShipmentOptions(item)
  const result = []
  for (const [key, value] of Object.entries(selection)) {
    const count = Number(value)
    const parcel = options.find(p => Number(p.shipmentId) === Number(key))
    if (!Number.isInteger(count) || count < 0 || (count > 0 && (!parcel || count > Number(parcel.refundable_quantity)))) {
      throw Error('所选包裹的可退数量已变化，请重新选择')
    }
    if (count > 0) result.push({shipmentId: Number(key), quantity: count})
  }
  if (result.reduce((total, p) => total + p.quantity, 0) !== needed) {
    throw Error('请为“' + item.name + '”选择合计 ' + needed + ' 件的退款包裹')
  }
  return result
}
