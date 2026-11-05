export function afterSaleMaximum(item,type){
 const value=Number(type==='refund'?item.refundable_quantity:item.delivered_refundable_quantity);
 return Number.isSafeInteger(value)&&value>0?value:0;
}
export function selectedAfterSaleItems(items,selected,type){
 const result=items.filter(i=>selected[i.id]).map(i=>({id:i.id,quantity:afterSaleMaximum(i,type)}));
 if(!result.length)throw Error('请选择需要售后的商品');
 if(result.some(i=>!i.quantity))throw Error('所选商品的售后状态已变化，请重新选择');
 return result;
}
