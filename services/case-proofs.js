// How many photos the customer attached to an after-sale case, read from the
// case record the list already returns (proofs_json is a JSON array of paths).
export function caseProofCount(record) {
 let list=record?.proofs_json
 if(typeof list==='string'){try{list=JSON.parse(list.trim()||'[]')}catch{return 0}}
 return Array.isArray(list)?Math.min(list.length,9):0
}

// Private photo address; it must be requested with the shopper's login header.
export function caseProofUrl(base,caseId,index,staff=false) {
 return String(base||'').replace(/\/+$/,'')+(staff?'/shop/app/staff/manage/cases/':'/shop/app/cases/')+encodeURIComponent(String(caseId))+'/proofs/'+Math.max(0,Math.floor(Number(index)||0))
}
