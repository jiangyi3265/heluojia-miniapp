// Decide once per checkout (keyed by the order request key) whether "使用小程序余额" starts switched on.
// Only ordinary retail checkout with a positive recharge balance defaults on; a customer who switches it off keeps it off on later quotes.
export function onlineBalanceDefault({checkoutKey,decidedKey='',channel,partnerPurchase,exchange,paymentMethod,available}={}){
 const key=String(checkoutKey||'')
 if(!key||key===decidedKey)return {decidedKey,turnOn:false}
 const balance=Number(available)
 const eligible=channel==='C'&&!partnerPurchase&&!exchange&&paymentMethod!=='credit'&&Number.isFinite(balance)&&balance>0
 return {decidedKey:key,turnOn:eligible}
}
