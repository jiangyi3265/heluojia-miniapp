// 微信一键登录建档时昵称默认叫“新朋友”（微信不再给真实昵称，getUserProfile 只返回“微信用户”），商家认不出是谁。
export const DEFAULT_NAMES=['新朋友','微信用户']
// 登录后还缺姓名或手机号（微信验证的 phone、自己填的 contact_phone 都算）就要先完善资料：新注册的人和以前登录的“新朋友”都一样。
export function needsProfile(m){if(!m)return false;const name=String(m.nickname||'').trim();return !name||DEFAULT_NAMES.includes(name)||(!m.phone&&!m.contact_phone)}
export const memberNeedsProfile=needsProfile
