import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {SKIN_GOALS,skincareStepError,createSkincareReport,restoreSkincareReport,skincareOwner,skincareStorageKey,skincareRecommendations,skincareContactError,skincareConsultationBody,skincareReportText} from '../services/skincare.js'

const answers={skin:'dry',age:'28',goals:['hydrate','night'],name:'小洛'}
const catalog=[
 {id:1,product_code:'HLJ-TONER',name:'精华水'},
 {id:2,product_code:'HLJ-EMULSION',name:'凝润乳'},
 {id:3,product_code:'HLJ-CLEAR-CREAM',name:'清透霜',spec:'清润'},
 {id:4,product_code:'HLJ-GENTLE-CREAM',name:'柔护霜',spec:'中润'},
 {id:5,product_code:'HLJ-RICH-CREAM',name:'奢润霜',spec:'倍润'},
 {id:6,product_code:'HLJ-FACIAL-OIL',name:'臻萃油'}
].map(p=>({...p,stock:10,price:19800,enabled:true,retail_enabled:1,archived:0}))

test('questionnaire requires a skin feel and 1–3 recognized goals; age is optional and never accepts decimals',()=>{
 assert.ok(skincareStepError({},1));assert.equal(skincareStepError(answers,1),'')
 for(const age of ['', '1','28','120'])assert.equal(skincareStepError({...answers,age},2),'')
 for(const age of ['0','-1','121','2.5','abc','2e1'])assert.ok(skincareStepError({...answers,age},2))
 for(const goals of [[],['medical'],SKIN_GOALS.slice(0,4).map(g=>g.id)])assert.ok(skincareStepError({...answers,goals},3))
 assert.ok(skincareStepError({...answers,name:' '},4))
})
test('report survives JSON storage without retaining unknown fields or contact data',()=>{
 const report=createSkincareReport({...answers,phone:'13800138000',diagnosis:'bad'})
 const restored=restoreSkincareReport(JSON.parse(JSON.stringify(report)))
 assert.deepEqual(restored,report);assert.equal(restored.answers.phone,undefined);assert.equal(restored.score,undefined)
 assert.equal(restoreSkincareReport({...report,version:2}),null)
 assert.equal(restoreSkincareReport({...report,createdAt:'invalid'}),null)
 assert.equal(restoreSkincareReport({...report,answers:{...answers,goals:[]}}),null)
})
test('local report keys are isolated for guests and different authenticated accounts',()=>{
 assert.equal(skincareOwner('',42),'guest');assert.equal(skincareOwner('token',42),'42');assert.equal(skincareOwner('token','../42'),'guest')
 assert.equal(new Set(['guest','42','43'].map(skincareStorageKey)).size,3)
})
test('dry/night preferences select the rich cream and optional oil from real inventory',()=>{
 const result=skincareRecommendations(catalog,answers)
 assert.deepEqual(result.map(p=>p.id),[1,2,5,6]);assert.match(result[2].reason,/倍润/)
})
test('light preference wins over dry skin and uses the current personalized price unchanged',()=>{
 const products=catalog.map(p=>({...p,price:12345}))
 const result=skincareRecommendations(products,{...answers,goals:['light','night']})
 assert.deepEqual(result.map(p=>p.id),[1,2,3,6]);assert.ok(result.every(p=>p.price===12345))
 assert.equal(products[0].role,undefined)
})
test('simple routine does not suggest a whole set even when night is also chosen',()=>{
 const result=skincareRecommendations(catalog,{...answers,goals:['simple','night']})
 assert.deepEqual(result.map(p=>p.id),[1,5])
})
test('offline, archived, wholesale-only, out of stock, invalid price and unknown products are never recommended',()=>{
 for(const change of [{enabled:0},{enabled:false},{enabled:'0'},{retail_enabled:0},{archived:'1'},{stock:0},{stock:-1},{price:null},{price:'bad'}])assert.deepEqual(skincareRecommendations(catalog.map(p=>({...p,...change})),answers),[])
 assert.deepEqual(skincareRecommendations([{...catalog[0],product_code:'TEST',name:'111'}],answers),[])
 assert.ok(skincareRecommendations(catalog.map(p=>({...p,archived:'0'})),answers).length)
 assert.deepEqual(skincareRecommendations(null,answers),[])
})
test('stock changes choose another real available cream, never a hardcoded missing item',()=>{
 const result=skincareRecommendations(catalog.map(p=>p.id===5?{...p,stock:0}:p),answers)
 assert.deepEqual(result.map(p=>p.id),[1,2,4,6]);assert.match(result[2].reason,/中润/)
 assert.deepEqual(skincareRecommendations([],answers),[])
})
test('legacy exact product names work, similar unknown products do not',()=>{
 const result=skincareRecommendations([{...catalog[0],product_code:'',name:'臻颜新肌精华水'}],answers)
 assert.equal(result.length,1)
 assert.equal(skincareRecommendations([{...catalog[0],product_code:'',name:'其他精华水'}],answers).length,0)
})
test('contact cannot submit without consent and validated fields; existing support accepts the message length',()=>{
 const form={name:'小洛',phone:'13800138000',city:'合肥',consent:true}
 assert.equal(skincareContactError(form),'')
 for(const change of [{consent:false},{phone:'123'},{name:''},{city:' ' }])assert.ok(skincareContactError({...form,...change}))
 const message=skincareConsultationBody(createSkincareReport(answers),form)
 assert.ok(message.length<2000);assert.match(message,/产品体验咨询/);assert.match(message,/13800138000/);assert.match(message,/合肥/);assert.match(message,/补水保湿、夜间滋养/);assert.doesNotMatch(message,/年龄|28 岁/)
 assert.throws(()=>skincareConsultationBody(null,form))
})
test('copied preference summary excludes personal name, age and contact details',()=>{
 const result=skincareReportText(createSkincareReport(answers))
 assert.match(result,/偏干/);assert.match(result,/补水保湿/);assert.doesNotMatch(result,/小洛|28|手机号/)
})
test('customization is the launch page and the existing mall route stays available',()=>{
 const pages=JSON.parse(readFileSync(new URL('../pages.json',import.meta.url),'utf8')).pages
 assert.equal(pages[0].path,'pages/skincare/index')
 assert.equal(pages.find(p=>p.path==='pages/index/index').style.navigationBarTitleText,'商城')
 assert.equal(pages.filter(p=>p.path==='pages/skincare/index').length,1)
})
