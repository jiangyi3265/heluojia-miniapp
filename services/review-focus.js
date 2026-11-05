// Narrow the review lists to one order when the page was opened from that order.
// Pending items carry order_no (and order_id when the server provides it);
// published reviews carry order_id.
export function reviewFocus(data,{orderId='',orderNo=''}={},showAll=false) {
 const eligible=Array.isArray(data?.eligible)?data.eligible:[],reviews=Array.isArray(data?.reviews)?data.reviews:[]
 const id=orderId==null?'':String(orderId).trim(),no=orderNo==null?'':String(orderNo).trim()
 if((!id&&!no)||showAll)return {focused:false,eligible,reviews,otherEligible:0,otherReviews:0}
 const matches=row=>(id&&row?.order_id!=null&&String(row.order_id)===id)||(no&&row?.order_no!=null&&String(row.order_no)===no)
 const ownEligible=eligible.filter(matches),ownReviews=reviews.filter(matches)
 return {focused:true,eligible:ownEligible,reviews:ownReviews,otherEligible:eligible.length-ownEligible.length,otherReviews:reviews.length-ownReviews.length}
}
