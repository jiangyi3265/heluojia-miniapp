// Real sold quantity comes from the server (paid, not test, minus refunds). The server leaves
// `soldCount` out when the shop turned the display off or the number is below its threshold,
// so an absent value must show nothing rather than "已售 0件".
export function soldCountText(value){
 if(value===null||value===undefined||value==='')return ''
 const number=Number(value)
 if(!Number.isFinite(number)||number<0)return ''
 const quantity=Math.floor(number)
 return '已售 '+(quantity>=10000?Math.floor(quantity/10000)+'万+':String(quantity))+'件'
}
