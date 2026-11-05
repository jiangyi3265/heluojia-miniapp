// The extended discovery questionnaire records preferences, not clinical findings.
export const SKINCARE_GENDERS=[{id:'female',label:'女',icon:'woman'},{id:'male',label:'男',icon:'man'}]
const choices=(items)=>items.map(([id,label])=>({id,label}))
export const SKINCARE_FOLLOWUPS=[
 {id:'experience',title:'之前通过哪些方式了解过护肤？',options:choices([['online','线上了解或选购护肤品'],['store','到门店咨询过产品'],['both','线上和门店都有了解'],['new','还没有，想从基础开始']])},
 {id:'schedule',title:'你最近的作息习惯是？',options:choices([['regular','比较规律'],['sometimes','偶尔晚睡'],['late','经常晚睡'],['unsure','不太固定']])},
 {id:'routine',title:'你平时会使用哪些护肤产品？',multiple:true,exclusive:'none',options:choices([['water','水类'],['emulsion','乳液'],['essence','精华或精华油'],['cream','面霜'],['mask','面膜'],['eye','眼部护理'],['none','暂时没有固定使用的产品']])},
 {id:'frequency',title:'平时会定期安排日常护理吗？',options:choices([['daily','基本每天都会'],['weekly','每周会安排几次'],['occasionally','想起来才会用'],['starting','准备开始建立习惯']])},
 {id:'storeVisits',title:'你通常多久去一次门店了解护肤？',options:choices([['often','经常去'],['sometimes','偶尔会去'],['never','还没有去过'],['online','更习惯线上了解']])},
 {id:'budget',title:'你更倾向的单品预算是？',options:choices([['under300','300 元以内'],['300to499','300–499 元'],['500to999','500–999 元'],['over1000','1000 元及以上'],['flexible','先了解产品，再决定预算']])},
 {id:'steps',title:'你希望日常护理有多少步骤？',options:choices([['simple','精简一些，优先 1–2 款单品'],['regular','按需要搭配水、乳和面霜'],['complete','想了解更完整的系列搭配'],['unsure','还不确定，先看看方案']])},
 {id:'priorities',title:'选择护肤品时，你更看重什么？',multiple:true,options:choices([['texture','质地与使用感'],['ingredients','产品成分与说明'],['price','价格与预算'],['brand','品牌与包装'],['guidance','用法与搭配建议']])},
 {id:'service',title:'你希望进一步了解哪些内容？',multiple:true,options:choices([['selection','帮我了解适合的单品'],['usage','产品用法与注意事项'],['pairing','与现有产品的搭配'],['experience','当前的产品体验活动']])}
]
export const blankSkincareSurvey=()=>({skin:'',age:'',goals:[],name:'',questionnaireVersion:2,gender:'',responses:{}})
export function normalizeSurveyDetails(value={}){
 const responses={};for(const question of SKINCARE_FOLLOWUPS){const input=value.responses?.[question.id];if(question.multiple){let values=[...new Set(Array.isArray(input)?input:[])].filter(id=>question.options.some(o=>o.id===id));if(question.exclusive&&values.includes(question.exclusive))values=[question.exclusive];if(values.length)responses[question.id]=values}else if(question.options.some(o=>o.id===input))responses[question.id]=input}
 return{questionnaireVersion:2,gender:['female','male','unspecified'].includes(value.gender)?value.gender:'',responses}
}
export function asSkincareSurvey(value={}){return{...blankSkincareSurvey(),skin:value.skin||'',age:String(value.age??''),goals:[...(value.goals||[])],name:value.name||'',...normalizeSurveyDetails(value)}}
export const skincareQuestionCount=answers=>answers?.goals?.length?13:3
export function skincareFollowupError(answers,step){const question=SKINCARE_FOLLOWUPS[step-5];if(!question)return '问卷题目不存在，请返回重试';const value=answers.responses?.[question.id];if(question.multiple){if(!Array.isArray(value)||!value.length||value.some(id=>!question.options.some(o=>o.id===id)))return '请至少选择一项';if(question.exclusive&&value.includes(question.exclusive)&&value.length>1)return '“暂时没有固定使用的产品”不能与其他产品同时选择'}else if(!question.options.some(o=>o.id===value))return '请选择一项后继续';return ''}
export function toggleSkincareResponse(answers,questionId,optionId){const question=SKINCARE_FOLLOWUPS.find(q=>q.id===questionId);if(!question||!question.options.some(o=>o.id===optionId))return answers;const responses={...(answers.responses||{})};if(!question.multiple)responses[questionId]=optionId;else{const old=Array.isArray(responses[questionId])?responses[questionId]:[];let values=old.includes(optionId)?old.filter(v=>v!==optionId):[...old,optionId];if(optionId===question.exclusive)values=old.includes(optionId)?[]:[optionId];else values=values.filter(v=>v!==question.exclusive);responses[questionId]=values}return{...answers,responses}}
export function skincareSurveySummary(answers){if(answers?.questionnaireVersion!==2)return[];const normalized=normalizeSurveyDetails(answers);return SKINCARE_FOLLOWUPS.map(question=>{const raw=normalized.responses[question.id],ids=Array.isArray(raw)?raw:[raw];return{id:question.id,question:question.title,answer:question.options.filter(o=>ids.includes(o.id)).map(o=>o.label).join('、')}}).filter(row=>row.answer)}
export function skincareCareNotes(answers){if(answers?.questionnaireVersion!==2)return[];const notes=[];const r=answers.responses||{};if(r.steps==='simple')notes.push('你希望精简步骤，方案优先保留精华水与一款面霜，单品可以按需选择。');else if(r.routine?.length&&!r.routine.includes('none'))notes.push('你已经有在用的护理产品，可以保留喜欢的单品，只了解需要补充的部分。');if(['occasionally','starting'].includes(r.frequency))notes.push('你希望慢慢建立护理习惯，可以先从熟悉包装用法、安排方便的使用时间开始。');if(r.priorities?.includes('texture'))notes.push('你更看重使用感，可以先比较清润、中润、倍润三种面霜，再决定想了解的款式。');if(r.service?.includes('experience'))notes.push('你关注产品体验活动，可以在方案页咨询商城客服了解当前安排。');return notes}
