// 网页版（H5）只能浏览商品：不能登录，也不能下单、付款。
// 网页上所有走到这一步的地方都用这里的同一套话：说清楚原因，并告诉顾客怎么打开小程序。
// 本文件不引用其他文件，方便测试里直接运行。

// 小程序在微信里的搜索名就是商家在后台填的店铺名；还没取到时用品牌名。
export const miniProgramName=shopName=>String(shopName||'').trim().slice(0,30)||'赫洛嘉'

export const openMiniProgramText=shopName=>'打开微信，点顶部的搜索框，输入「'+miniProgramName(shopName)+'」，找到我们的小程序点开。'

// 登录页（网页版没法登录）显示的整块说明。fromCheckout：顾客是点“结算”被带到这里的。
export function h5StopGuide(shopName,{fromCheckout=false}={}){
 return {
  title:'请在微信小程序里登录和下单',
  reason:'网页版只能浏览商品，不能登录，也不能下单、付款。',
  how:openMiniProgramText(shopName)+'登录后再下单。',
  note:fromCheckout?'在网页里选好的商品不会带到小程序，请在小程序里重新选择。':'',
  name:miniProgramName(shopName)
 }
}

// 顾客点了只有小程序才能做的按钮时弹出的一句话（action：登录 / 付款）。
export const h5ActionText=(shopName,action)=>'网页版不能'+action+'，请在微信里搜索「'+miniProgramName(shopName)+'」小程序后再'+action

// 收银台里取代付款按钮的说明。
export const h5PayText=shopName=>'网页版不能付款。'+openMiniProgramText(shopName)+'在“我的订单”里完成付款。'

// 复制链接按钮旁边的说明：复制出来的是网页地址，打开后只能看，不能下单。
// kind：product 普通顾客；promoter 推广人员（还要知道怎样才能把朋友记在自己名下）；invite 邀请分销伙伴。
export function copyLinkNote(shopName,kind='product'){
 const name=miniProgramName(shopName)
 if(kind==='invite')return '复制的网页链接不能直接申请成为分销伙伴。请让朋友在微信里搜索「'+name+'」小程序后申请；想让他记在你名下，请在小程序里点“邀请伙伴”发给他。'
 const base='复制的网页链接只能用来看，不能登录下单。朋友想下单，请让他在微信里搜索「'+name+'」小程序。'
 return kind==='promoter'?base+'想让朋友记在你名下，请在小程序里用分享按钮转发给他。':base
}
