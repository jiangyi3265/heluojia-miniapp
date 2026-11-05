// Promotion identifiers and assistant credentials are separate business concepts.
export function promotionCode(member){
 const id=String(member?.id||'');
 return member?.distributor_state==='approved'&&/^[1-9][0-9]{0,14}$/.test(id)?id:'';
}
export function assistantInvitation(value){
 let text=String(value||'').trim();
 const match=text.match(/[?&#]assistantInvite=([^&#]+)/);
 if(match){try{text=decodeURIComponent(match[1])}catch{throw Error('助手邀请链接不完整，请重新复制')}}
 if(!/^[a-zA-Z0-9]{32}$/.test(text))throw Error('请粘贴完整的助手邀请码，不能使用推广邀请码');
 return text;
}
