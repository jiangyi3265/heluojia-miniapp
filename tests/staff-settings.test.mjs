import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers} from './staff-component-harness.mjs'
const s=await loadHelpers('../pages/staff/services/staff-settings.js')

// ui-spec §4.4 (= api-spec §5.1) sample.
const sample={canEdit:true,
 withdrawal:{values:{withdrawMinimum:1000,withdrawFee:100,withdrawTaxRate:2000,withdrawWorkingDays:3,withdrawMaxAmount:20000}},
 serviceFee:{distributorServiceRate:100},
 delivery:{base:'3f1a9c',methods:['express','pickup'],
  rules:[{index:0,method:'express',methodLabel:'快递配送',regionsText:'未单独设置的地区',first:1,next:1,firstFee:1000,nextFee:500,remoteFee:0,freeAmount:9900}],
  points:[{id:'point_1727000000000_ab12cd',name:'赫洛嘉旗舰店',address:'长沙市岳麓区示例路 1 号',hours:'每天 9:00-21:00',warehouseId:1,warehouseName:'长沙主仓',warehouseEnabled:true,pendingPickups:2}],
  warehouses:[{id:1,name:'长沙主仓'}],notice:'下单后 48 小时内发货'}}
const clone=x=>JSON.parse(JSON.stringify(x))
const w=sample.withdrawal.values
const wf=(x={})=>({...s.withdrawalForm(w),...x})

test('withdrawal form round trip',()=>{
 assert.deepEqual(s.withdrawalForm(w),{withdrawMinimum:'10.00',withdrawFee:'1.00',withdrawTaxRate:'20',withdrawWorkingDays:'3',withdrawMaxAmount:'200.00'})
 assert.equal(s.readWithdrawalForm(s.withdrawalForm(w),w).error,'没有修改任何内容')
 assert.deepEqual(s.readWithdrawalForm(wf({withdrawMinimum:'20'}),w),{values:{withdrawMinimum:2000,withdrawFee:100,withdrawTaxRate:2000,withdrawWorkingDays:3,withdrawMaxAmount:20000}})
})

test('withdrawal validation mirrors the PC',()=>{
 const err=x=>s.readWithdrawalForm(wf(x),w).error
 assert.equal(err({withdrawMinimum:'0'}),undefined)
 assert.equal(err({withdrawMinimum:'1.001'}),'最低提现金额应在0至1,000,000元之间，填0表示不设门槛，最多两位小数')
 assert.equal(err({withdrawFee:'1000000.01'}),'每笔提现手续费应在0至1,000,000元之间，最多两位小数')
 assert.equal(err({withdrawFee:'10'}),'最低提现金额必须大于手续费')
 assert.equal(err({withdrawTaxRate:'50.01'}),'提现代扣比例为0%至50%，最多两位小数')
 assert.equal(err({withdrawTaxRate:'1.234'}),'提现代扣比例为0%至50%，最多两位小数')
 assert.equal(err({withdrawWorkingDays:'0'}),'提现处理时限为1至30个工作日')
 assert.equal(err({withdrawWorkingDays:'31'}),'提现处理时限为1至30个工作日')
 assert.equal(err({withdrawWorkingDays:'2.5'}),'提现处理时限为1至30个工作日')
 const maxWords='单笔提现最多到账要在 0.10 元到 1999.99 元之间（2000 元及以上微信要求核验收款人实名，本系统暂不支持）'
 assert.equal(err({withdrawMaxAmount:'abc'}),maxWords)
 assert.equal(err({withdrawMaxAmount:'2000'}),maxWords)
 assert.equal(err({withdrawMaxAmount:'0.09'}),maxWords)
 assert.equal(err({withdrawMaxAmount:'5'}),'单笔提现最多到账（¥5.00）不能低于最低提现金额（¥10.00），否则推广员无法提现')
 assert.equal(err({withdrawMinimum:'300'}),'单笔提现最多到账（¥200.00）不能低于最低提现金额（¥300.00），否则推广员无法提现')
 assert.equal(err({withdrawMaxAmount:'1999.99'}),undefined)
 const high={...w,withdrawMaxAmount:250000}
 assert.deepEqual(s.readWithdrawalForm({...s.withdrawalForm(high),withdrawMinimum:'20'},high).values,{...high,withdrawMinimum:2000})
 assert.deepEqual(s.readWithdrawalForm({...s.withdrawalForm(w),withdrawWorkingDays:'５'},w).values.withdrawWorkingDays,5)
})

test('confirm lists only changed values and warns on the per-withdrawal maximum',()=>{
 assert.equal(s.withdrawalConfirmText(w,{...w,withdrawMinimum:2000}),'最低提现金额：¥10.00 → ¥20.00\n确认保存？')
 const up=s.withdrawalConfirmText(w,{...w,withdrawMaxAmount:30000})
 assert.match(up,/^单笔提现最多到账：¥200\.00 → ¥300\.00\n/);assert.match(up,/不低于 ¥300\.00/)
 assert.match(s.withdrawalConfirmText(w,{...w,withdrawMaxAmount:15000}),/已提交但到账超过 ¥150\.00 的申请不能审核通过/)
 const tax=s.withdrawalConfirmText(w,{...w,withdrawTaxRate:0})
 assert.equal(tax,'提现代扣比例：20% → 不代扣\n代扣比例只影响之后的新申请。\n确认保存？')
 assert.equal(s.withdrawalConfirmText(w,{...w,withdrawWorkingDays:5}),'处理时限：3 个工作日 → 5 个工作日\n确认保存？')
})

test('example calculation',()=>{
 assert.deepEqual(s.readWithdrawalForm(wf({withdrawMinimum:'0',withdrawFee:'0'}),w).values,{...w,withdrawMinimum:0,withdrawFee:0})
 assert.equal(s.withdrawalExampleText({withdrawMinimum:0,withdrawFee:0,withdrawTaxRate:1300},100),'不设提现门槛，扣费后到账至少 ¥0.10。举例：推广员申请 ¥1.00时，代扣税费 ¥0.13，平台服务费 ¥0.01，手续费 ¥0.00，实际到账 ¥0.86。')
 assert.equal(s.withdrawalExampleText({withdrawMinimum:1000,withdrawFee:100,withdrawTaxRate:2000},100),'举例：推广员申请 ¥10.00（最低提现金额）时，代扣税费 ¥2.00，平台服务费 ¥0.10，手续费 ¥1.00，实际到账 ¥6.90。')
 assert.match(s.withdrawalExampleText({withdrawMinimum:100,withdrawFee:95,withdrawTaxRate:2000},100),/实际到账不足 ¥0\.10，微信不能转账，建议调整。$/)
 assert.equal(s.withdrawalFormExample(wf(),100),s.withdrawalExampleText(w,100))
 assert.equal(s.withdrawalFormExample(wf({withdrawFee:'x'}),100),'')
 assert.equal(s.withdrawalNotice(w),'')
 assert.match(s.withdrawalNotice({withdrawMinimum:30000,withdrawMaxAmount:20000}),/低于最低提现金额 ¥300\.00/)
})

test('service rate',()=>{
 assert.deepEqual(s.readServiceRate('1.5',sample.serviceFee),{values:{distributorServiceRate:150}})
 assert.equal(s.readServiceRate('50.01',sample.serviceFee).error,'分销商平台服务费比例须在0%至50%之间，最多两位小数')
 assert.equal(s.readServiceRate('',sample.serviceFee).error,'分销商平台服务费比例须在0%至50%之间，最多两位小数')
 assert.equal(s.readServiceRate('1',sample.serviceFee).error,'没有修改任何内容')
 const text=s.serviceConfirmText(sample.serviceFee,{distributorServiceRate:150})
 assert.match(text,/扣 ¥1\.50/);assert.match(text,/^分销商平台服务费：1% → 1\.5%\n/)
 assert.equal(s.rateToPercentInput(150),'1.5')
})

test('delivery sends only patches and checks rules and stores',()=>{
 const d=sample.delivery
 const f=s.deliveryForm(d)
 f.rules[0].firstFee='12'
 assert.deepEqual(s.readDeliveryForm(f,d,d.warehouses).values.rules,[{index:0,firstFee:1200,nextFee:500,remoteFee:0,freeAmount:9900}])
 const g=s.deliveryForm(d)
 g.points.push({key:s.newPointKey(),id:'',name:'梅溪湖店',address:'长沙市岳麓区梅溪湖路88号',hours:'',warehouseId:1,pendingPickups:0})
 const added=s.readDeliveryForm(g,d,d.warehouses).values
 assert.deepEqual(added.points[1],{id:'',name:'梅溪湖店',address:'长沙市岳麓区梅溪湖路88号',hours:'',warehouseId:1})
 assert.deepEqual(added.points[0],{id:'point_1727000000000_ab12cd',name:'赫洛嘉旗舰店',address:'长沙市岳麓区示例路 1 号',hours:'每天 9:00-21:00',warehouseId:1})
 assert.deepEqual(added.methods,['express','pickup'])
 const h=s.deliveryForm(d);h.methods.local=true
 assert.equal(s.readDeliveryForm(h,d,d.warehouses).error,'开启“同城配送”前，请先在电脑后台为它设置运费规则，或在这里关闭“同城配送”')
 const i=s.deliveryForm(d);i.points=[]
 assert.equal(s.readDeliveryForm(i,d,d.warehouses).error,'开启门店自提前请至少保留一个门店')
 const j=s.deliveryForm(d);j.methods={express:false,freight:false,local:false,pickup:false}
 assert.equal(s.readDeliveryForm(j,d,d.warehouses).error,'请至少开启一种配送方式')
 const off=clone(d);off.points[0].warehouseEnabled=false;off.points[0].warehouseName='老仓'
 const k=s.deliveryForm(off);assert.equal(k.points[0].warehouseId,null)
 assert.equal(s.readDeliveryForm(k,off,off.warehouses).error,'请为门店“赫洛嘉旗舰店”选择备货仓库')
 const l=s.deliveryForm(d);l.points[0].warehouseId=9
 assert.equal(s.readDeliveryForm(l,d,d.warehouses).error,'门店“赫洛嘉旗舰店”对应的仓库已停用或不存在，请重新选择')
 const m=s.deliveryForm(d);m.rules[0].freeAmount='1.001'
 assert.equal(s.readDeliveryForm(m,d,d.warehouses).error,'「快递配送 · 未单独设置的地区」的满额包邮金额应在0至1,000,000元之间，最多两位小数')
 const n=s.deliveryForm(d);n.points[0].name='  '
 assert.equal(s.readDeliveryForm(n,d,d.warehouses).error,'请填写门店名称（最多80字）')
 const o=s.deliveryForm(d);o.points.push({key:'x',id:'',name:'新店',address:'短',hours:'',warehouseId:1})
 assert.equal(s.readDeliveryForm(o,d,d.warehouses).error,'门店“新店”的详细地址请填写5至400字')
 const p=s.deliveryForm(d);p.points[0].hours='时'.repeat(81)
 assert.equal(s.readDeliveryForm(p,d,d.warehouses).error,'门店“赫洛嘉旗舰店”的营业时间最多80字')
 assert.equal(s.readDeliveryForm(s.deliveryForm(d),d,d.warehouses).error,'没有修改任何内容')
 const many=s.deliveryForm(d);many.points=Array.from({length:101},(_,x)=>({key:'k'+x,id:'',name:'店'+x,address:'长沙市某某路'+x+'号',hours:'',warehouseId:1}))
 assert.equal(s.readDeliveryForm(many,d,d.warehouses).error,'门店最多100个')
})

test('delivery change lines',()=>{
 const d=clone(sample.delivery);d.points[0].name='赫洛嘉老店'
 const values={methods:['express','pickup'],rules:[{index:0,firstFee:1000,nextFee:500,remoteFee:0,freeAmount:9900}],points:[{id:'',name:'梅溪湖店',address:'长沙市岳麓区梅溪湖路88号',hours:'',warehouseId:1}]}
 const lines=s.deliveryChangeLines(d,values,d.warehouses)
 assert.deepEqual(lines,['新增门店：梅溪湖店','删除门店：赫洛嘉老店（还有 2 笔待自提订单，仍按原门店信息取货）'])
 const free=s.deliveryChangeLines(sample.delivery,{methods:['express','pickup'],rules:[{index:0,firstFee:1000,nextFee:500,remoteFee:0,freeAmount:0}],points:[{id:'point_1727000000000_ab12cd',name:'赫洛嘉旗舰店',address:'长沙市岳麓区示例路 1 号',hours:'每天 9:00-21:00',warehouseId:1}]})
 assert.deepEqual(free,['「快递配送 · 未单独设置的地区」满额包邮金额：¥99.00 → 不包邮'])
 const edit=s.deliveryChangeLines(sample.delivery,{methods:['express','pickup','freight'],rules:[],points:[{id:'point_1727000000000_ab12cd',name:'旗舰店',address:'长沙市岳麓区示例路 1 号',hours:'',warehouseId:2}]})
 assert.deepEqual(edit,['开启：物流配送','修改门店：旗舰店（名称、营业时间、备货仓库）'])
 const ten={methods:['express'],rules:[{index:0,firstFee:1,nextFee:2,remoteFee:3,freeAmount:4}],points:Array.from({length:5},(_,x)=>({id:'',name:'店'+x,address:'长沙市某某路',hours:'',warehouseId:1}))}
 const all=s.deliveryChangeLines(sample.delivery,ten)
 assert.equal(all.length,11)
 const text=s.deliveryConfirmText(sample.delivery,ten)
 assert.equal(text.split('\n').length,8+1+2);assert.match(text,/\n等共 11 项修改\n只影响之后的新订单，已下单的仍按下单时的规则。\n确认保存？$/)
 const ten2={...ten,points:ten.points.slice(0,4)}
 assert.match(s.deliveryConfirmText(sample.delivery,ten2),/等共 10 项修改/)
 assert.equal(s.removePointConfirmText({name:'赫洛嘉旗舰店',pendingPickups:2}),'「赫洛嘉旗舰店」还有 2 笔待自提订单。删除后这些订单仍按原门店信息取货，新订单不能再选这家门店。确认删除？')
 assert.equal(s.removePointConfirmText({name:'',pendingPickups:0}),'删除门店「新门店」？删除后新订单不能再选这家门店。')
})

test('rule titles and warehouses read in plain words',()=>{
 assert.equal(s.ruleTitle(sample.delivery.rules[0]),'快递配送 · 未单独设置的地区')
 assert.equal(s.ruleTitle({method:'local'}),'同城配送 · 未填写地区')
 assert.equal(s.ruleFeeText(sample.delivery.rules[0]),'首 1 件 ¥10.00，每续 1 件加 ¥5.00；满 ¥99.00 包邮')
 assert.equal(s.pointWarehouseText({warehouseEnabled:false,warehouseName:'老仓'}),'老仓（已停用，请修改）')
 assert.equal(s.pointWarehouseText({warehouseEnabled:false}),'原仓库已停用，请修改')
 assert.equal(s.pointWarehouseText({warehouseEnabled:true,warehouseName:'长沙主仓'}),'长沙主仓')
 assert.match(s.newPointKey(1727000000000,()=>0.5),/^new_1727000000000_[a-z0-9]{6}$/)
 assert.equal(s.methodLabel('x'),'其他配送方式')
})

test('a value that did not stick is reported in plain words',()=>{
 const fresh=clone(sample)
 assert.equal(s.afterSaveMismatch('withdrawal',{...w,withdrawMaxAmount:20000},fresh),'')
 assert.equal(s.afterSaveMismatch('withdrawal',{...w,withdrawMaxAmount:30000},fresh),'保存后读到的单笔提现最多到账是 ¥200.00，和刚才填写的不一致，请核对或到电脑后台查看。')
 assert.equal(s.afterSaveMismatch('service',{distributorServiceRate:150},fresh),'保存后读到的分销商平台服务费是 1%，和刚才填写的不一致，请核对或到电脑后台查看。')
 assert.equal(s.afterSaveMismatch('delivery',{},fresh),'')
 assert.equal(s.afterSaveMismatch('withdrawal',w,null),'')
})

test('operator texts carry no technical words',()=>{
 const bad=/接口|参数|同步|错误码|字段|配置|token|null|undefined|NaN|[A-Za-z]{3,}/
 for(const t of [s.WITHDRAW_MAX_NOTE,s.TAX_NOTE,s.DAYS_NOTE,s.SERVICE_NOTE,s.SETTINGS_UNCERTAIN,...s.DELIVERY_METHODS.map(m=>m[1]),...s.WITHDRAWAL_FIELDS.map(f=>f[1]),s.withdrawalExampleText({},undefined),s.withdrawalConfirmText(w,{withdrawMinimum:2000,withdrawFee:200,withdrawTaxRate:0,withdrawWorkingDays:5,withdrawMaxAmount:10000}),s.valueText('days',undefined)])assert.doesNotMatch(t,bad,t)
 assert.match('设置刚被别人改过，请刷新后再改',s.STALE_SETTINGS)
})
