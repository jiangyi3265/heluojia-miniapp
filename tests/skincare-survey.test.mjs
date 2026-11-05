import test from 'node:test'
import assert from 'node:assert/strict'
import {blankSkincareSurvey,asSkincareSurvey,skincareQuestionCount,SKINCARE_FOLLOWUPS,toggleSkincareResponse,skincareSurveySummary} from '../services/skincare-survey.js'
import {skincareStepError,createSkincareReport,restoreSkincareReport,skincareRecommendations,skincareConsultationBody} from '../services/skincare.js'
function complete(){let a={...blankSkincareSurvey(),gender:'unspecified',age:'',goals:['hydrate'],skin:'dry',name:'小洛'};for(const q of SKINCARE_FOLLOWUPS)a=toggleSkincareResponse(a,q.id,q.options[0].id);return a}
test('selecting goals expands the questionnaire and all ten follow-up steps require valid answers',()=>{
 const a=blankSkincareSurvey();assert.equal(skincareQuestionCount(a),3);a.goals=['hydrate'];assert.equal(skincareQuestionCount(a),13)
 for(let step=1;step<=13;step++)if(step!==2&&step!==3)assert.ok(skincareStepError(a,step),`step ${step}`)
 const done=complete();for(let step=1;step<=14;step++)assert.equal(skincareStepError(done,step),'',`step ${step}`)
})
test('gender can be withheld and age stays optional without skipping later questions',()=>{
 const a=complete();assert.equal(skincareStepError(a,1),'');assert.equal(skincareStepError(a,2),'');assert.ok(skincareStepError({...a,gender:'other-input'},1));assert.ok(skincareStepError({...a,age:'30.5'},2))
})
test('multiple product choices toggle independently; none is exclusive in both directions',()=>{
 let a=blankSkincareSurvey();a=toggleSkincareResponse(a,'routine','water');a=toggleSkincareResponse(a,'routine','cream');assert.deepEqual(a.responses.routine,['water','cream']);a=toggleSkincareResponse(a,'routine','water');assert.deepEqual(a.responses.routine,['cream']);a=toggleSkincareResponse(a,'routine','none');assert.deepEqual(a.responses.routine,['none']);a=toggleSkincareResponse(a,'routine','cream');assert.deepEqual(a.responses.routine,['cream'])
})
test('version 2 reports persist every selected answer, strip unknown data and reject incomplete follow-ups',()=>{
 const a=complete();a.responses.privateNotes='secret';a.phone='13800138000';const report=createSkincareReport(a);assert.equal(report.version,2);assert.deepEqual(restoreSkincareReport(JSON.parse(JSON.stringify(report))),report);assert.equal(report.answers.phone,undefined);assert.equal(report.answers.responses.privateNotes,undefined);assert.equal(skincareSurveySummary(report.answers).length,9)
 for(const q of SKINCARE_FOLLOWUPS){const responses={...report.answers.responses};delete responses[q.id];assert.equal(restoreSkincareReport({...report,answers:{...report.answers,responses}}),null)}
})
test('old reports remain readable and editing creates a fresh extended draft without mutating the report',()=>{
 const old=createSkincareReport({skin:'dry',age:'28',goals:['hydrate'],name:'小洛'});assert.equal(restoreSkincareReport(old).version,1);const draft=asSkincareSurvey(old.answers);assert.equal(draft.questionnaireVersion,2);draft.goals.push('night');assert.deepEqual(old.answers.goals,['hydrate']);assert.deepEqual(draft.responses,{})
})
test('simple steps constrain product recommendations without modifying live prices',()=>{
 const products=['HLJ-TONER','HLJ-EMULSION','HLJ-RICH-CREAM','HLJ-FACIAL-OIL'].map((code,i)=>({id:i+1,product_code:code,price:12345,stock:3,enabled:true,retail_enabled:1}));const a=complete();a.goals=['night'];a.responses.steps='simple';const result=skincareRecommendations(products,a);assert.deepEqual(result.map(p=>p.product_code),['HLJ-TONER','HLJ-RICH-CREAM']);assert.ok(result.every(p=>p.price===12345))
})
test('consultation still excludes gender, age and detailed habits from the outgoing message',()=>{
 const a=complete();a.gender='female';a.age='37';a.responses.schedule='late';const body=skincareConsultationBody(createSkincareReport(a),{name:'小洛',phone:'13800138000',city:'合肥',consent:true});assert.doesNotMatch(body,/性别|female|37岁|37 岁|晚睡|作息/);assert.match(body,/补水保湿/)
})
