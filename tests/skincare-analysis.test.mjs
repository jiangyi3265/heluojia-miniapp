import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeSkincare,skincareBudgetMatch,skincareProductContext} from '../services/skincare-analysis.js'
import {skincareRecommendations,createSkincareReport,restoreSkincareReport} from '../services/skincare.js'
const answers=(overrides={})=>({questionnaireVersion:2,gender:'unspecified',age:'',name:'体验用户',skin:'dry',goals:['hydrate'],responses:{experience:'online',schedule:'regular',routine:['water','cream'],frequency:'daily',storeVisits:'online',budget:'under300',steps:'regular',priorities:['texture'],service:['selection']},...overrides})
const products=['HLJ-TONER','HLJ-EMULSION','HLJ-CLEAR-CREAM','HLJ-GENTLE-CREAM','HLJ-RICH-CREAM','HLJ-FACIAL-OIL'].map((code,i)=>({id:i+1,product_code:code,price:35000,stock:4,enabled:true,retail_enabled:1}))

test('analysis changes with answers and uses the same texture choice as the product plan',()=>{
 for(const [skin,goal,code] of [['dry','hydrate','HLJ-RICH-CREAM'],['oily','hydrate','HLJ-CLEAR-CREAM'],['combination','season','HLJ-CLEAR-CREAM'],['balanced','daily','HLJ-GENTLE-CREAM'],['unsure','night','HLJ-RICH-CREAM']]){
  const a=answers({skin,goals:[goal]}),analysis=analyzeSkincare(a),plan=skincareRecommendations(products,a)
  assert.equal(analysis.texture.code,code);assert.ok(plan.some(p=>p.product_code===code));assert.ok(analysis.topics[0].lead.includes(analysis.topics[0].title))
 }
 assert.notDeepEqual(analyzeSkincare(answers()),analyzeSkincare(answers({skin:'oily'})))
})
test('conflicting dry and light preferences are explained rather than reported as a diagnosis',()=>{
 const result=analyzeSkincare(answers({goals:['light']}));assert.equal(result.texture.label,'清润');assert.match(result.findings[0].text,/同时填写了偏干与清爽偏好/);assert.match(result.findings[0].evidence,/清爽肤感/);assert.equal(result.score,undefined)
})
test('simple steps, existing products, frequency, schedule and service affect distinct report sections',()=>{
 const a=answers();a.responses={...a.responses,steps:'simple',frequency:'starting',schedule:'late',priorities:['ingredients','price'],service:['pairing','experience']}
 const result=analyzeSkincare(a);assert.match(result.findings[1].text,/不额外加入乳液或精华油/);assert.match(result.findings[2].text,/准备开始/);assert.match(result.findings[2].extra,/不固定/);assert.equal(result.service.length,3);assert.match(result.topics[0].next,/预算提示/)
 assert.equal(skincareRecommendations(products,a).length,2)
})
test('budget comparison respects exact yuan boundaries without changing live prices',()=>{
 assert.equal(skincareBudgetMatch(30000,'under300').status,'within');assert.equal(skincareBudgetMatch(30001,'under300').status,'above')
 assert.equal(skincareBudgetMatch(29999,'300to499').status,'below');assert.equal(skincareBudgetMatch(49900,'300to499').status,'within');assert.equal(skincareBudgetMatch(49901,'300to499').status,'above')
 assert.equal(skincareBudgetMatch(100000,'over1000').status,'within');assert.equal(skincareBudgetMatch(null,'under300').status,'unknown');assert.equal(skincareBudgetMatch(35000,'flexible').status,'open')
 const source={...products[0]},result=skincareProductContext(source,answers());assert.equal(result.price,source.price);assert.deepEqual(source,products[0]);assert.equal(result.budgetMatch.status,'above')
})
test('product context distinguishes an owned category and a stock fallback from a preferred texture',()=>{
 const a=answers();assert.equal(skincareProductContext(products[0],a).owned,true);assert.equal(skincareProductContext(products[1],a).owned,false)
 const fallback=skincareProductContext(products[2],a);assert.match(fallback.reason,/优先考虑的倍润款暂不可选/);assert.doesNotMatch(skincareProductContext(products[4],a).reason,/暂不可选/)
})
test('age and gender do not invent different analysis or a skin score; restored answers reproduce results',()=>{
 const a=answers(),report=createSkincareReport(a);assert.deepEqual(analyzeSkincare(restoreSkincareReport(report).answers),analyzeSkincare(a))
 assert.deepEqual(analyzeSkincare({...a,gender:'male',age:'57'}),analyzeSkincare({...a,gender:'female',age:'19'}));assert.equal(analyzeSkincare(a).score,undefined)
})
test('legacy reports declare missing habit data and do not assume a new user owns no products',()=>{
 const result=analyzeSkincare({skin:'balanced',goals:['daily'],age:'',name:'旧用户'});assert.equal(result.limited,true);assert.match(result.findings[1].text,/还未记录在用产品/);assert.match(result.findings[1].evidence,/暂未填写/)
})
