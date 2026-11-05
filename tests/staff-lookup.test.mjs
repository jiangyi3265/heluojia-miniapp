import test from 'node:test'
import assert from 'node:assert/strict'
import {loadHelpers} from './staff-component-harness.mjs'
const l=await loadHelpers('../pages/staff/services/staff-lookup.js')

test("search input is classified with the server's grammar and words",()=>{
 assert.deepEqual(l.classifySearch('13800001234'),{kind:'phone',value:'13800001234'})
 assert.deepEqual(l.classifySearch('23800001234'),{kind:'phone',value:'23800001234'})
 assert.deepEqual(l.classifySearch('138 0000-1234'),{kind:'phone',value:'13800001234'})
 assert.deepEqual(l.classifySearch(' 1234 '),{kind:'phoneTail',value:'1234'})
 assert.deepEqual(l.classifySearch('bc1727338000a1'),{kind:'order',value:'BC1727338000a1'})
 assert.deepEqual(l.classifySearch('BC1727338000000a1b2c3'),{kind:'order',value:'BC1727338000000a1b2c3'})
 assert.deepEqual(l.classifySearch('＃123'),{kind:'memberId',value:'#123'})
 assert.equal(l.classifySearch('#0').error,'会员编号请输入 # 加数字，例如 #123')
 assert.equal(l.classifySearch('#ab').error,'会员编号请输入 # 加数字，例如 #123')
 assert.equal(l.classifySearch('BC12345').error,'订单号至少输入 BC 加 6 位数字')
 assert.equal(l.classifySearch('12345').error,'请输入完整的11位手机号、手机号后4位、以 BC 开头的订单号，或在会员号前加 #（例如 #123）')
 assert.equal(l.classifySearch('王').error,'昵称至少输入2个字')
 assert.deepEqual(l.classifySearch('王 小'),{kind:'nickname',value:'王 小'})
 assert.equal(l.classifySearch('').error,'请输入手机号、订单号、昵称或会员号')
 assert.equal(l.classifySearch('   ').error,'请输入手机号、订单号、昵称或会员号')
 assert.equal(l.classifySearch('王'.repeat(41)).error,'搜索内容最多40个字')
 assert.deepEqual(l.classifySearch('王'.repeat(40)),{kind:'nickname',value:'王'.repeat(40)})
})

test('labels',()=>{
 assert.equal(l.identityText(['分销商','企业']),'分销商 · 企业')
 assert.equal(l.identityText([]),'顾客');assert.equal(l.identityText(null),'顾客')
 assert.equal(l.orderStatusText({status:'paid'}),'待发货')
 assert.equal(l.orderStatusText({status:'shipped',statusLabel:'已发货'}),'已发货')
 assert.equal(l.orderStatusText({}),'处理中')
 assert.equal(l.callablePhone('138****1234'),false);assert.equal(l.callablePhone('13800001234'),true);assert.equal(l.callablePhone(''),false)
 assert.equal(l.memberTitle({realName:'',nickname:'小林'}),'小林')
 assert.equal(l.memberTitle({realName:'林小姐',nickname:'小林'}),'林小姐')
 assert.equal(l.memberTitle({}),'商城顾客')
 assert.equal(l.personLine({memberId:88,name:'王推广（手机尾号 5555）'}),'王推广（手机尾号 5555）（会员编号 88）')
 assert.equal(l.SEARCH_KIND_LABEL.phoneTail,'手机尾号')
})

test('view stack keeps at most six screens',()=>{
 let stack=[]
 for(let i=1;i<=7;i++)stack=l.pushView(stack,{id:i})
 assert.deepEqual(stack.map(x=>x.id),[2,3,4,5,6,7])
 assert.deepEqual(l.pushView(null,{id:1}),[{id:1}])
})

// Review finding: 商城余额 is what the customer can spend now; money held by unpaid orders is not inside it, so it must not read 「其中…」.
test('wallet lines list held money beside the balance, not inside it',()=>{
 const w={online:{available:7000,reserved:3000},legacy:{available:500,reserved:0},refundFrozen:200}
 assert.deepEqual(l.walletLines(w),[{label:'商城余额',value:7000},{label:'另有待付款订单占用',value:3000},{label:'门店余额',value:500},{label:'充值退款处理中',value:200}])
 assert.deepEqual(l.walletLines({online:{available:12000,reserved:0},legacy:{},refundFrozen:0}),[{label:'商城余额',value:12000}])
 assert.deepEqual(l.walletLines(null),[{label:'商城余额',value:0}])
 for(const line of l.walletLines(w))assert.doesNotMatch(line.label,/^其中/)
})

// Review finding: the points part used to be shown twice (inside 优惠 and again as 积分抵扣).
test('order amount lines never count the points part twice',()=>{
 // Retail order ¥100.00, ¥10.00 paid with points, free shipping. The server sends 优惠 without the points part.
 const retail={subtotal:10000,shipping:0,discount:0,pointsDiscount:1000,pointsExchange:false,amount:9000}
 assert.deepEqual(l.orderAmountLines(retail),[{label:'商品金额',value:10000},{label:'运费',value:0},{label:'积分抵扣',value:-1000}])
 // Coupon ¥5.00 plus points ¥10.00, shipping ¥8.00.
 const mixed={subtotal:10000,shipping:800,discount:500,pointsDiscount:1000,amount:9300}
 assert.deepEqual(l.orderAmountLines(mixed).map(x=>x.label),['商品金额','运费','优惠','积分抵扣'])
 // Points exchange: the whole price is paid with points.
 const exchange={subtotal:12800,shipping:0,discount:0,pointsDiscount:12800,pointsExchange:true,amount:0}
 assert.deepEqual(l.orderAmountLines(exchange).map(x=>x.label),['商品金额','运费','积分兑换'])
 for(const a of [retail,mixed,exchange])assert.equal(l.orderAmountLines(a).reduce((n,x)=>n+x.value,0),a.amount)
 assert.deepEqual(l.orderAmountLines({}),[{label:'商品金额',value:0},{label:'运费',value:0}])
})

test('operator texts carry no technical words',()=>{
 const bad=/接口|参数|同步|错误码|字段|配置|token|null|undefined|NaN|[A-Za-z]{3,}/
 for(const t of [l.SEARCH_HELP,...Object.values(l.SEARCH_KIND_LABEL),...['','#x','BC1','12345','王','王'.repeat(41)].map(q=>l.classifySearch(q).error)])assert.doesNotMatch(t,bad,t)
})
