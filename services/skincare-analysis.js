// Explain the customer's answers. These rules do not measure or diagnose skin.
import {skinFeelLabel,selectedSkincareGoals,skincareTexturePreference} from './skincare.js'
import {skincareSurveySummary} from './skincare-survey.js'

const ROUTINE_NAMES={water:'水类',emulsion:'乳液',essence:'精华或精华油',cream:'面霜',mask:'面膜',eye:'眼部护理'}
const BUDGETS={under300:{label:'300 元以内',min:0,max:30000},'300to499':{label:'300–499 元',min:30000,max:49900},'500to999':{label:'500–999 元',min:50000,max:99900},over1000:{label:'1000 元及以上',min:100000,max:Infinity}}
const PRODUCT_CATEGORY={'HLJ-TONER':'water','HLJ-EMULSION':'emulsion','HLJ-CLEAR-CREAM':'cream','HLJ-GENTLE-CREAM':'cream','HLJ-RICH-CREAM':'cream','HLJ-FACIAL-OIL':'essence'}

export function skincareBudgetMatch(price,budget){
 const range=BUDGETS[budget]
 if(!range)return{status:'open',label:'按需选择',budget:'预算未限定'}
 if(price==null||!Number.isFinite(Number(price))||Number(price)<0)return{status:'unknown',label:'价格待确认',budget:range.label}
 const amount=Number(price)
 return{status:amount>range.max?'above':amount<range.min?'below':'within',label:amount>range.max?'高于单品预算':amount<range.min?'低于所选预算区间':'符合单品预算',budget:range.label}
}

export function skincareProductContext(product,answers={}){
 const r=answers.responses||{},category=PRODUCT_CATEGORY[product.product_code],owned=(r.routine||[]).includes(category)
 const texture=skincareTexturePreference(answers)
 const simple=answers.goals?.includes('simple')||r.steps==='simple'
 let reason=product.reason||'可结合自己的日常习惯了解这款单品。'
 if(category==='cream')reason=(product.product_code===texture.code?`按你填写的肤感与目标，优先比较${texture.label}质地。`:`优先考虑的${texture.label}款暂不可选，这款是当前在售的其他质地，请先比较商品说明。`)
 else if(category==='water'&&simple)reason='你选择了精简步骤，因此先保留水类和一款面霜供比较。'
 else if(category==='emulsion')reason=answers.goals?.includes('makeup')?'你关注妆前打底，可结合已有彩妆了解乳液的质地。':'你愿意了解水、乳、霜搭配，这款作为乳液类的可选项。'
 else if(category==='essence')reason='你关注润泽或晚间护理，因此补充一款护理油供了解，可按需选择。'
 return{...product,reason,owned,ownership:owned?'已有同类，可先比较':'可了解的单品',budgetMatch:skincareBudgetMatch(product.price,r.budget)}
}

export function analyzeSkincare(answers={}){
 const r=answers.responses||{},goals=selectedSkincareGoals(answers),skin=skinFeelLabel(answers),texture=skincareTexturePreference(answers)
 const rows=skincareSurveySummary(answers),answer=id=>rows.find(row=>row.id===id)?.answer||'暂未填写'
 const simple=answers.goals?.includes('simple')||r.steps==='simple'
 const existing=(r.routine||[]).filter(id=>ROUTINE_NAMES[id]).map(id=>ROUTINE_NAMES[id])
 const routineTitle=simple?'精简搭配':r.steps==='complete'?'按需完善':'日常搭配'
 const textureEvidence=texture.source==='light'?'你选择了「清爽肤感」':texture.source==='skin'?`你填写的日常肤感为「${skin}」`:texture.source==='night'?'你选择了「夜间滋养」':'你没有限定润泽程度'
 const textureText=texture.source==='light'&&answers.skin==='dry'?'你同时填写了偏干与清爽偏好。本次先按你主动选择的清爽使用感，列出清润款供比较；若想更润泽，也可查看中润与倍润。':answers.skin==='combination'?'你填写了混合肤感，不同部位的感受可能不同。本次先列出清润质地供比较，选购时也可以说明局部的不同偏好。':answers.skin==='unsure'&&texture.source==='open'?'你还不确定自己的肤感，因此先把中润作为比较起点，并保留清润、倍润两种选择。':`本次优先列出${texture.label}质地供你比较。这里依据的是你填写的使用感与护理目标，实际质地仍可在商品页进一步了解。`
 const routineText=simple?'你更倾向少量步骤，先比较精华水和一款面霜，不额外加入乳液或精华油。':existing.length?`你已有${existing.join('、')}类产品。可以保留喜欢的单品，方案会标出已有同类，帮助你决定要不要补充。`:r.routine?.includes('none')?'你暂时没有固定使用的产品。方案按水类、乳液和面霜整理，方便逐款了解，不要求整套购买。':'这份问卷还未记录在用产品。可以先比较水、乳、霜的不同选择，再决定是否补充。'
 const regular=r.frequency==='daily'
 const rhythmTitle=regular?'延续已有习惯':['starting','occasionally'].includes(r.frequency)?'先建立简单日常':'按自己的节奏安排'
 const rhythmText=regular?'你已经基本每天安排护理。可以先沿用现有习惯，再查看想补充的质地与单品。':r.frequency==='starting'?'你准备开始建立护理习惯。先选一两款想了解的产品，熟悉包装上的用法，再慢慢决定搭配。':r.frequency==='occasionally'?'你填写了想起来才会护理。先保留容易安排的步骤，选择自己方便的时间，不必为增加步骤而增加产品。':'可以把想了解的产品放进自己方便的日常时段，再按实际需要增减步骤。'
 const scheduleNote=['late','unsure'].includes(r.schedule)?'你也提到作息较晚或不固定，方案不会据此判断皮肤问题；护理安排可以优先考虑省时和方便。':r.schedule==='sometimes'?'你偶尔晚睡，护理安排可随当天时间调整；这项回答不用于推断皮肤状况。':''
 const budget=BUDGETS[r.budget],budgetText=budget?`你选择的单品预算为${budget.label}。方案会逐款标出与预算的关系，金额来自当前商城；这是单品预算，不是整套预算。`:r.budget==='flexible'?'你希望先了解产品再决定预算。方案展示当前商城价格，方便逐款比较。':'这份问卷尚未记录预算，暂不判断商品是否符合你的预算。可以先查看当前商城价格，或重新填写问卷。'
 const findings=[
  {id:'texture',number:'01',title:`质地方向 · ${texture.label}`,evidence:textureEvidence,text:textureText},
  {id:'routine',number:'02',title:existing.length&&!simple?'保留已有，按需补充':routineTitle,evidence:`步骤偏好：${answer('steps')}${existing.length?'；在用：'+existing.join('、'):''}`,text:routineText},
  {id:'rhythm',number:'03',title:rhythmTitle,evidence:`护理频率：${answer('frequency')}`,text:rhythmText,extra:scheduleNote},
  {id:'budget',number:'04',title:'选品也照顾你的预算',evidence:`单品预算：${answer('budget')}`,text:budgetText}
 ]
 const service=[]
 if(r.priorities?.includes('ingredients'))service.push('你重视成分与说明：可先查看商品详情和包装，缺少的成分信息可向商城客服确认。')
 if(r.service?.includes('pairing'))service.push('你想了解与现有产品的搭配：咨询时可以主动说明正在使用的具体单品。')
 if(r.service?.includes('usage')||r.priorities?.includes('guidance'))service.push('你关注用法：查看每款包装指引，或请客服说明使用方式。')
 if(r.service?.includes('experience'))service.push('你关注产品体验：方案页可咨询当前的体验安排、费用与库存。')
 if(!service.length)service.push('先查看方案中的商品与质地，再决定想进一步了解的单品。')
 return{
  version:1,headline:`${texture.label}质地 · ${routineTitle}`,summary:`你关注${goals.map(g=>g.label).join('、')||'日常护理'}，填写的日常肤感为${skin}。本次从质地、搭配、习惯和预算四个方向，为你整理护理选择。`,
  texture,findings,service,existing,limited:answers.questionnaireVersion!==2,
  dimensions:[{label:'质地参考',value:texture.label},{label:'步骤方向',value:routineTitle},{label:'护理节奏',value:regular?'已有日常':r.frequency==='starting'?'准备开始':r.frequency?'按需安排':'尚未记录'},{label:'单品预算',value:budget?.label||(r.budget==='flexible'?'按需选择':'尚未记录')}],
  topics:goals.map(goal=>({id:goal.id,title:goal.label,lead:`你选择了「${goal.label}」。结合${skin}肤感与${simple?'精简步骤':'日常搭配'}的偏好，本项重点是：${goal.tip}`,
   texture:textureText,routine:routineText,evidence:[textureEvidence,`你希望：${answer('steps')}`],next:`${rhythmText}${r.priorities?.includes('price')?' 你也重视价格，可以先看方案中的预算提示，再决定选哪一款。':''}`}))
 }
}
