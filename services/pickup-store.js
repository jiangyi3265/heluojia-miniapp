// Opening hours for a pickup store are optional in the admin; without them, ask the customer to check with the store first.
export function pickupHoursText(point){
 const hours=String(point?.hours??'').trim()
 return hours?'营业时间：'+hours:'取货前请联系门店确认营业时间'
}
