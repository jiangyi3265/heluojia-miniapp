// A quick double tap must not open the same page twice. Only an identical url
// inside the short window is ignored; other pages and later taps still open.
export function createNavigationGuard({windowMs=800,now=()=>Date.now()}={}) {
 let lastUrl='',lastAt=-Infinity
 return function allowNavigation(url) {
  const at=now()
  if(url===lastUrl&&at-lastAt>=0&&at-lastAt<windowMs)return false
  lastUrl=url;lastAt=at
  return true
 }
}
