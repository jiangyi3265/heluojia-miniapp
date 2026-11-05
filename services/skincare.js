// Preference-based product discovery. No skin diagnosis, efficacy score or price calculation.
import {normalizeSurveyDetails,skincareFollowupError} from './skincare-survey.js'
export const SKIN_FEELS = [
 {id:'dry',label:'偏干',hint:'洗脸后容易感觉紧绷',icon:'drop'},
 {id:'oily',label:'偏油',hint:'更喜欢清爽的肤感',icon:'sun'},
 {id:'combination',label:'混合',hint:'不同部位的肤感有差异',icon:'balance'},
 {id:'balanced',label:'适中',hint:'日常肤感比较平衡',icon:'smile'},
 {id:'unsure',label:'还不确定',hint:'先从日常护理开始',icon:'leaf'}
]
export const SKIN_GOALS = [
 {id:'hydrate',label:'补水保湿',icon:'drop',tip:'从精华水与保湿类产品中，挑选喜欢的质地。'},
 {id:'light',label:'清爽肤感',icon:'feather',tip:'优先查看清润质地，按实际肤感调整用量。'},
 {id:'soft',label:'柔润呵护',icon:'care',tip:'从日常保湿开始，选择使用起来舒适的质地。'},
 {id:'daily',label:'日常维养',icon:'sun',tip:'根据自己的使用习惯，建立方便坚持的日常护理。'},
 {id:'radiance',label:'润泽光采',icon:'spark',tip:'可以了解精华油类产品，具体用法以产品说明为准。'},
 {id:'simple',label:'精简护肤',icon:'leaf',tip:'先选少量适合自己的单品，不必一次叠加整套产品。'},
 {id:'makeup',label:'妆前打底',icon:'smile',tip:'查看乳液等质地，结合后续彩妆的实际使用感选择。'},
 {id:'season',label:'换季护理',icon:'balance',tip:'留意季节变化带来的肤感差异，重新选择清润或丰润质地。'},
 {id:'night',label:'夜间滋养',icon:'moon',tip:'为晚间护理留一点时间，按包装指引使用喜欢的单品。'}
]
export const blankSkincareAnswers=()=>({skin:'',age:'',goals:[],name:''})
const cleanText=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim():''
export function normalizeSkincareAnswers(value={}) {
 return {skin:SKIN_FEELS.some(s=>s.id===value.skin)?value.skin:'',age:String(value.age??'').trim(),
  goals:[...new Set(Array.isArray(value.goals)?value.goals:[])].filter(id=>SKIN_GOALS.some(g=>g.id===id)).slice(0,3),name:cleanText(value.name).slice(0,20),...(value.questionnaireVersion===2?normalizeSurveyDetails(value):{})}
}
export function skincareStepError(answers,step) {
 const extended=answers.questionnaireVersion===2
 if(extended&&step===1&&!['female','male','unspecified'].includes(answers.gender))return '请选择一项，或选择暂不填写'
 if(((!extended&&step===1)||(extended&&step===4))&&!SKIN_FEELS.some(s=>s.id===answers.skin))return '请选择一种日常肤感'
 if(step===2&&String(answers.age??'').trim()&&!/^(?:[1-9]|[1-9][0-9]|1[01][0-9]|120)$/.test(String(answers.age).trim()))return '请输入 1–120 之间的整数年龄，或留空跳过'
 if(step===3&&(!Array.isArray(answers.goals)||answers.goals.length<1||answers.goals.length>3||answers.goals.some(id=>!SKIN_GOALS.some(g=>g.id===id))))return '请选择 1–3 项护理偏好'
 if(extended&&step>=5&&step<=13)return skincareFollowupError(answers,step)
 if(step===(extended?14:4)&&(!cleanText(answers.name)||cleanText(answers.name).length>20))return '请填写 1–20 字的称呼'
 return ''
}
export function createSkincareReport(answers,now=Date.now()) {
 const version=answers.questionnaireVersion===2?2:1
 for(let step=1;step<=(version===2?14:4);step++){const error=skincareStepError(answers,step);if(error)throw Error(error)}
 return {version,id:'skin_'+now.toString(36)+'_'+Math.random().toString(36).slice(2,9),createdAt:new Date(now).toISOString(),answers:normalizeSkincareAnswers(answers)}
}
export function restoreSkincareReport(value) {
 if(!value||![1,2].includes(value.version)||typeof value.id!=='string'||!/^skin_[a-z0-9_]{5,50}$/.test(value.id)||!Number.isFinite(Date.parse(value.createdAt)))return null
 if((value.version===2)!==(value.answers?.questionnaireVersion===2))return null
 const answers=normalizeSkincareAnswers(value.answers||{})
 for(let step=1;step<=(value.version===2?14:4);step++)if(skincareStepError(answers,step))return null
 return {version:value.version,id:value.id,createdAt:value.createdAt,answers}
}
export function skincareOwner(token,owner){return token&&/^[1-9][0-9]{0,14}$/.test(String(owner))?String(owner):'guest'}
export const skincareStorageKey=owner=>'shop-skincare-v1-'+owner
export const selectedSkincareGoals=answers=>(answers?.goals||[]).map(id=>SKIN_GOALS.find(g=>g.id===id)).filter(Boolean)
export const skinFeelLabel=answers=>SKIN_FEELS.find(s=>s.id===answers?.skin)?.label||'还不确定'

const PRODUCT_NAMES={
 'HLJ-TONER':'臻颜新肌精华水','HLJ-EMULSION':'臻颜新肌凝润乳',
 'HLJ-CLEAR-CREAM':'臻颜新肌清透霜','HLJ-GENTLE-CREAM':'臻颜新肌柔护霜',
 'HLJ-RICH-CREAM':'臻颜新肌奢润霜','HLJ-FACIAL-OIL':'新肌臻萃油'
}
const off=value=>value===false||value===0||value==='0'
export function skincareTexturePreference(answers={}) {
 const goals=answers?.goals||[]
 if(goals.includes('light')||['oily','combination'].includes(answers?.skin))return{code:'HLJ-CLEAR-CREAM',label:'清润',source:goals.includes('light')?'light':'skin',codes:['HLJ-CLEAR-CREAM','HLJ-GENTLE-CREAM','HLJ-RICH-CREAM']}
 if(answers?.skin==='dry'||goals.includes('night'))return{code:'HLJ-RICH-CREAM',label:'倍润',source:answers?.skin==='dry'?'skin':'night',codes:['HLJ-RICH-CREAM','HLJ-GENTLE-CREAM','HLJ-CLEAR-CREAM']}
 return{code:'HLJ-GENTLE-CREAM',label:'中润',source:'open',codes:['HLJ-GENTLE-CREAM','HLJ-CLEAR-CREAM','HLJ-RICH-CREAM']}
}
export function skincareRecommendations(products,answers) {
 // Match maintained brand product codes (legacy exact names as fallback), never arbitrary/test products.
 const available=(Array.isArray(products)?products:[]).filter(p=>p&&Number(p.id)>0&&!off(p.enabled)&&!off(p.retail_enabled)&&Number(p.archived||0)===0&&Number(p.stock)>0&&p.price!=null&&Number.isFinite(Number(p.price))&&Number(p.price)>=0)
 const pick=code=>available.find(p=>p.product_code===code)||available.find(p=>!p.product_code&&p.name===PRODUCT_NAMES[code])
 const goals=new Set(answers?.goals||[])
 if(answers?.responses?.steps==='simple')goals.add('simple')
 const creams=skincareTexturePreference(answers).codes
 const result=[]
 const add=(product,role,reason)=>{if(product&&!result.some(p=>String(p.id)===String(product.id)))result.push({...product,role,reason})}
 add(pick('HLJ-TONER'),'水润打底','精华水单品，供日常护理时选择。')
 if(!goals.has('simple'))add(pick('HLJ-EMULSION'),'柔润衔接',goals.has('makeup')?'根据妆前护理偏好，了解乳液的质地与用法。':'乳液单品，可结合自己的肤感选择。')
 const cream=creams.map(pick).find(Boolean)
 add(cream,'保湿收尾',cream?.spec?'当前可选质地：'+cream.spec+'。请结合实际肤感选择。':'面霜单品，具体用法参照包装说明。')
 if(!goals.has('simple')&&(goals.has('radiance')||goals.has('night')))add(pick('HLJ-FACIAL-OIL'),'按需搭配','根据润泽类护理偏好，提供精华油单品供了解。')
 return result
}
export function skincareContactError(form) {
 if(!cleanText(form.name)||cleanText(form.name).length>30)return '请填写 1–30 字的姓名或称呼'
 if(!/^1[3-9]\d{9}$/.test(String(form.phone||'').trim()))return '请填写正确的 11 位手机号'
 if(cleanText(form.city).length<2||cleanText(form.city).length>60)return '请填写所在城市，2–60 字'
 if(!form.consent)return '请先同意将联系方式和护理偏好发送给商城客服'
 return ''
}
export function skincareConsultationBody(report,form) {
 const error=skincareContactError(form);if(error)throw Error(error)
 const valid=restoreSkincareReport(report);if(!valid)throw Error('请先完成护肤问卷')
 return ['【专属护肤方案 · 产品体验咨询】','姓名/称呼：'+cleanText(form.name),'手机号：'+String(form.phone).trim(),'所在城市：'+cleanText(form.city),
  '日常肤感：'+skinFeelLabel(valid.answers),'护理偏好：'+selectedSkincareGoals(valid.answers).map(g=>g.label).join('、'),
  '客户希望了解适合自己的商品及是否有体验活动。体验安排、费用与库存请由客服确认。',
  '客户已同意将以上联系方式和护理偏好发送给商城客服，用于本次咨询。','方案编号：'+valid.id].join('\n')
}
export function skincareReportText(report) {
 const valid=restoreSkincareReport(report);if(!valid)return ''
 return ['赫洛嘉 · 我的护肤偏好','日常肤感：'+skinFeelLabel(valid.answers),'护理偏好：'+selectedSkincareGoals(valid.answers).map(g=>g.label).join('、'),'根据个人填写的偏好整理，供选购参考。'].join('\n')
}
