import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {loadHelpers,loadComponent,fakeUni,settle} from './staff-component-harness.mjs'

// 第 15 批（店主 10-04）：手机“客户档案”能看全部 C 端、B 端客户；店长或财务给客户充值（一个人登记即到账），
// 记进门店余额，拿货和零售都能用；店长可以作废没用掉的。请求、会话、确认框都是替身，不连真实后端。
const require=createRequire(import.meta.url)
const {createSSRApp}=require('vue'),{renderToString}=require('vue/server-renderer')
const management=await loadHelpers('../pages/staff/services/staff-management.js')
const c=await loadHelpers('../pages/staff/services/staff-customers.js')
const w=await loadHelpers('../services/staff-workbench.js')
const source=rel=>readFileSync(new URL(rel,import.meta.url),'utf8')

const ROLE={
 manager:{bound:true,canViewMoney:true,canViewCustomers:true,canLookupCustomers:true,canViewCustomerArchive:true,canTopUpCustomers:true,canVoidTopUps:true},
 finance:{bound:true,canViewMoney:true,canLookupCustomers:true,canViewCustomerArchive:true,canTopUpCustomers:true},
 service:{bound:true,canViewCustomers:true,canLookupCustomers:true,canViewCustomerArchive:true}
}
async function withUni(run,{confirm=true,toasts=[]}={}){
 const prior=globalThis.uni;globalThis.uni=fakeUni(toasts,confirm)
 try{return await run()}finally{if(prior===undefined)delete globalThis.uni;else globalThis.uni=prior}
}
function panel(me,request,session={token:'staff-t1'}){
 return loadComponent('../pages/staff/components/StaffCustomers.vue',{...management,...c,request,getToken:()=>session.token},{module:'customers',me})
}
async function render(vm){
 const template=source('../pages/staff/components/StaffCustomers.vue').match(/<template>([\s\S]*)<\/template>\s*<script>/)[1]
 const app=createSSRApp({template,setup:()=>vm})
 app.config.compilerOptions.isCustomElement=tag=>['view','text','image','input','textarea','picker','switch','scroll-view'].includes(tag)
 app.config.warnHandler=()=>{}
 return (await renderToString(app)).replace(/<!--[\s\S]*?-->/g,'')
}
const ROWS=[
 {memberId:5,nickname:'小王',realName:'王小明',phone:'138****8000',identities:['分销商'],segment:'buying',enabled:true,createdAt:'2026-10-01 10:00:00',lastPaidAt:'2026-10-03 09:30',paidOrders:3,storeBalance:5000,onlineBalance:0},
 {memberId:4,nickname:'老李',realName:'',phone:'',identities:['顾客'],segment:'retail',enabled:true,createdAt:'2026-09-01 10:00:00',lastPaidAt:'',paidOrders:0}
]
const detailOf=(extra={})=>({
 member:{memberId:5,nickname:'小王',realName:'王小明',phone:'13800138000',identities:['分销商'],enabled:true,isTest:false,createdAt:'2026-10-01 10:00:00'},
 segment:'buying',orders:{total:1,rows:[{orderId:9,orderNo:'BC20261003000001',statusLabel:'待发货',amount:12000,paidAt:'2026-10-03 09:30:00',itemsText:'面霜'}]},
 money:{wallet:{legacy:{available:5000,reserved:0},online:{available:0,reserved:0},refundFrozen:0}},
 actions:{canTopUp:true,topUpBlocked:'',canVoid:true},storeBalanceUsable:true,
 topups:[{id:31,memberId:5,amount:5000,method:'cash',methodLabel:'现金',reference:'',note:'',state:'valid',stateLabel:'已到账',createdBy:'boss（小程序）',createdAt:'2026-10-04 10:00'}],
 methods:[{key:'cash',label:'现金'},{key:'bank',label:'对公转账',referenceRequired:true},{key:'wechat',label:'微信转账'},{key:'alipay',label:'支付宝转账'},{key:'other',label:'其他'}],...extra})

// ---------- 规则 ----------
test('余额筛选和排序只给能看客户的钱的人；搜索写法与服务器一致',()=>{
 assert.deepEqual(c.filtersFor(ROLE.service).map(f=>f.key),['all','retail','buying'])
 assert.deepEqual(c.filtersFor(ROLE.finance).map(f=>f.key),['all','retail','buying','balance'])
 assert.deepEqual(c.sortsFor(ROLE.service).map(s=>s.key),['recent','newest'])
 assert.deepEqual(c.sortsFor(ROLE.manager).map(s=>s.key),['recent','newest','balance'])
 assert.equal(c.listQuery({q:' 王小 ',filter:'buying',sort:'balance',page:2}),'q=%E7%8E%8B%E5%B0%8F&filter=buying&sort=balance&page=2')
 assert.equal(c.listQuery({filter:'vip',sort:'name'}),'q=&filter=all&sort=recent&page=1')
 assert.equal(c.searchProblem('123'),'请输入完整的11位手机号、手机号后4位，或在会员号前加 #（例如 #123）')
 assert.equal(c.searchProblem('#0'),'会员编号请输入 # 加数字，例如 #123')
 assert.equal(c.searchProblem('王'),'昵称或姓名至少输入2个字')
 for(const ok of ['','１３８００１３８０００','8000','#12','王小'])assert.equal(c.searchProblem(ok),'',ok)
})
test('充值金额按分计算，不经过小数；表单错误用店员看得懂的话',()=>{
 assert.equal(c.topupYuanToFen('50'),5000);assert.equal(c.topupYuanToFen('0.01'),1);assert.equal(c.topupYuanToFen('1000000'),100000000);assert.equal(c.topupYuanToFen('０.５'),50);assert.equal(c.topupYuanToFen('19.99'),1999)
 assert.throws(()=>c.topupYuanToFen('1000000.01'),/充值金额要在 0.01 元到 100 万元之间/)
 assert.throws(()=>c.topupYuanToFen('0'),/充值金额要在 0.01 元到 100 万元之间/)
 assert.throws(()=>c.topupYuanToFen('1.234'),/请填写正确的金额，最多保留两位小数/)
 assert.throws(()=>c.topupYuanToFen(''),/请填写充值金额/)
 const key=c.newTopupRequestKey(1759550000000,()=>0.123456789);assert.match(key,c.TOPUP_REQUEST_KEY);assert.match(key,/^mtop_/)
 const form=(x={})=>({amount:'50',method:'cash',reference:'',note:'',requestKey:key,...x})
 assert.deepEqual(c.readTopupForm(form()),{body:{amount:5000,method:'cash',reference:'',note:'',requestKey:key,confirmSharedReference:false}})
 assert.deepEqual(c.readTopupForm(form({method:'bank',reference:'6222 0001'})).body.reference,'62220001','银行流水号去掉空格，和服务器认重复的写法一致')
 assert.equal(c.readTopupForm(form({method:'bank',reference:'12'})).error,'对公转账请填写银行流水号')
 assert.equal(c.readTopupForm(form({method:'card'})).error,'请选择收款方式')
 assert.equal(c.readTopupForm(form({note:'字'.repeat(301)})).error,'备注最多300个字')
 assert.equal(c.readTopupForm(form({reference:'1'.repeat(121)})).error,'流水号或收款说明最多120个字')
 assert.equal(c.readTopupForm(form({requestKey:'x'})).error,'请重新打开充值窗口后再提交')
 assert.equal(c.readVoidForm({reason:' 错 '}).error,'请填写2至300字作废原因')
 assert.deepEqual(c.readVoidForm({reason:' 金额填错 '}),{body:{reason:'金额填错'}})
})
test('门店余额和小程序充值余额分开写，待付款占用写“另有”，确认框说清楚到账和用途',()=>{
 assert.deepEqual(c.balanceLines({legacy:{available:5000,reserved:1000},online:{available:300,reserved:0},refundFrozen:0}).map(l=>[l.label,l.value]),
  [['门店余额（拿货、零售都能用）',5000],['另有门店余额被待付款订单占用',1000],['小程序充值余额（只能零售）',300]])
 assert.deepEqual(c.balanceLines(null).map(l=>l.value),[0,0])
 const m={memberId:5,realName:'王小明',phone:'138****8000'}
 const text=c.topupConfirmText(m,{amount:5000,method:'bank',reference:'62220001'})
 for(const part of ['王小明（会员编号 5，138****8000）','¥50.00','对公转账（62220001）','确认钱已经收到','门店余额','拿货和零售都能用'])assert.ok(text.includes(part),part)
 assert.ok(c.voidConfirmText(m,{amount:5000,createdAt:'2026-10-04 10:00'}).includes('从客户的门店余额扣回 ¥50.00，不能恢复'))
 assert.equal(c.afterTopupText({legacy:{available:5000}},2500),'充值后门店余额约 ¥75.00')
 const now=Date.parse('2026-10-04T10:05:00+08:00')
 assert.match(c.recentDuplicate([{state:'valid',amount:5000,createdAt:'2026-10-04 10:00',createdBy:'boss'}],5000,now),/10 分钟内已给这位客户登记过一笔 ¥50.00，登记人 boss，请确认不是重复登记。/)
 assert.equal(c.recentDuplicate([{state:'valid',amount:5000,createdAt:'2026-10-04 09:50'}],5000,now),'')
 assert.equal(c.recentDuplicate([{state:'void',amount:5000,createdAt:'2026-10-04 10:00'}],5000,now),'')
 assert.equal(c.lastPaidText(ROWS[0]),'最近消费 2026-10-03 09:30（共 3 单）');assert.equal(c.lastPaidText(ROWS[1]),'还没有付款的订单')
})

// ---------- 菜单与岗位 ----------
test('“客户档案”在菜单里紧跟“客户订单”，客服只看、店长财务能充值',()=>{
 const info=management.MANAGEMENT_MODULES.find(m=>m.key==='customers')
 assert.deepEqual([info.title,info.capability,info.edit],['客户档案','canViewCustomerArchive','canTopUpCustomers'])
 assert.deepEqual(management.managementModules(ROLE.service).map(m=>m.key),['lookup','customers','members'])
 assert.equal(management.moduleHint(info,ROLE.service),'只能查看客户档案，充值由店长或财务登记')
 assert.equal(management.moduleHint(info,ROLE.finance),'全部客户、门店余额与充值')
 assert.match(w.abilityText(ROLE.finance),/给客户充值/);assert.match(w.abilityText(ROLE.service),/查看客户档案/)
 assert.match(source('../pages/staff/components/StaffWorkbench.vue'),/<StaffCustomers v-else-if="activeModule==='customers'" key="customers" ref="management" module="customers" :me="me" @access-change="refresh" @busy="moduleBusy=\$event"\/>/)
})

// ---------- 列表 ----------
test('客服的列表：不显示余额，没有按余额筛选和排序',()=>withUni(async()=>{
 const calls=[];const {vm,component}=panel(ROLE.service,async path=>{calls.push(path);return {total:2,rows:ROWS.map(({storeBalance,onlineBalance,...r})=>r)}})
 component.mounted.call(vm);await settle()
 assert.deepEqual(calls,['/staff/manage/customers?q=&filter=all&sort=recent&page=1'])
 const html=await render(vm)
 for(const part of ['共 2 位客户','王小明','B端拿货','C端顾客','最近消费 2026-10-03 09:30（共 3 单）','只能查看客户档案，充值由店长或财务登记'])assert.ok(html.includes(part),part)
 for(const hidden of ['门店余额 ¥','有门店余额','门店余额多'])assert.ok(!html.includes(hidden),hidden)
}))
test('店长的列表显示门店余额，可以按门店余额排序；换条件时旧结果不覆盖新结果',()=>withUni(async()=>{
 const calls=[];let release;const slow=new Promise(r=>release=r)
 const {vm,component}=panel(ROLE.manager,async path=>{calls.push(path);if(calls.length===1)return slow;return {total:1,rows:[ROWS[0]]}})
 component.mounted.call(vm);vm.setSort('balance');await settle()
 assert.equal(calls.at(-1),'/staff/manage/customers?q=&filter=all&sort=balance&page=1')
 release({total:2,rows:ROWS});await settle()
 assert.deepEqual(vm.rows.map(r=>r.memberId),[5],'先发出的那次读取晚到，不能盖掉按余额排序的结果')
 const html=await render(vm)
 assert.ok(html.includes('门店余额 ¥50.00'));assert.ok(html.includes('门店余额多'))
 vm.q='123';vm.search();assert.equal(vm.error,'请输入完整的11位手机号、手机号后4位，或在会员号前加 #（例如 #123）');assert.equal(calls.length,2,'服务器会拒绝的搜索不发出去')
}))

test('列表滑到底自动加载下一页（与分销商页一致）；不在列表、正在读取或已经读完时不再读（复核 B15-9）',()=>withUni(async()=>{
 const calls=[];const {vm,component}=panel(ROLE.manager,async path=>{calls.push(path);return {total:25,rows:path.endsWith('page=1')?Array.from({length:20},(_,i)=>({...ROWS[1],memberId:100+i})):Array.from({length:5},(_,i)=>({...ROWS[1],memberId:200+i}))}})
 component.mounted.call(vm);await settle()
 vm.loadMore();await settle()
 assert.deepEqual(calls,['/staff/manage/customers?q=&filter=all&sort=recent&page=1','/staff/manage/customers?q=&filter=all&sort=recent&page=2'])
 assert.equal(vm.rows.length,25)
 vm.loadMore();await settle();assert.equal(calls.length,2,'已经读完全部 25 位')
 vm.view='detail';vm.total=99;vm.loadMore();await settle();assert.equal(calls.length,2,'在档案详情里滑到底不读列表')
}))

// ---------- 详情与充值 ----------
function openDetail(me,request,session){
 const r=panel(me,request,session);r.vm.view='detail';r.vm.detailId=5;r.vm.detail=detailOf();return r
}
test('店长：档案里有余额、充值记录、“给客户充值”和“作废”；充值确认后按原样提交并直接用返回的最新档案',()=>withUni(async()=>{
 const posts=[];const fresh=detailOf({topups:[{...detailOf().topups[0],id:32,amount:2500}]})
 const {vm,emitted}=openDetail(ROLE.manager,async(path,method,body)=>{if(method==='POST'){posts.push([path,body]);return {topup:{id:32},repeated:false,detail:fresh}}throw Error('unexpected read '+path)})
 const html=await render(vm)
 for(const part of ['门店余额（拿货、零售都能用）','¥50.00','给客户充值','门店充值记录','登记：boss（小程序）','作废','最近订单','BC20261003000001'])assert.ok(html.includes(part),part)
 vm.openTopup();assert.equal(vm.view,'editor');assert.match(vm.editor.requestKey,c.TOPUP_REQUEST_KEY)
 vm.editor.amount='25';vm.editor.method='cash'
 const modals=[];globalThis.uni.showModal=o=>{modals.push(o);o.success({confirm:true})}
 await vm.submit()
 assert.equal(modals.length,1);assert.ok(modals[0].content.includes('¥25.00'));assert.ok(modals[0].content.includes('门店余额'))
 assert.deepEqual(posts,[['/staff/manage/customers/5/topups',{amount:2500,method:'cash',reference:'',note:'',requestKey:posts[0][1].requestKey,confirmSharedReference:false}]])
 assert.equal(vm.view,'detail');assert.deepEqual(vm.detail,fresh,'成功后直接用服务器返回的最新档案');assert.equal(vm.detail.topups[0].id,32);assert.equal(vm.listStale,true)
 assert.deepEqual(emitted.filter(e=>e[0]==='busy'),[['busy',true],['busy',false]])
}))
test('充值结果没收到：表单锁住，再点只会原样重发同一个请求号（服务器不会重复到账）',()=>withUni(async()=>{
 const posts=[];let lost=true
 const {vm}=openDetail(ROLE.finance,async(path,method,body)=>{if(method==='POST'){posts.push(JSON.parse(JSON.stringify(body)));if(lost){lost=false;const e=Error('网络不稳定');e.uncertain=true;throw e}return {repeated:true,detail:detailOf()}}return detailOf()})
 vm.openTopup();vm.editor.amount='50';vm.editor.method='bank';vm.editor.reference='6222 0001'
 await vm.submit()
 assert.equal(vm.uncertain,true);assert.equal(vm.locked,true);assert.equal(vm.pendingTopup.memberId,5)
 vm.editor.amount='99'// locked inputs: even if changed, the resend uses what was sent
 await vm.submit()
 assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(posts[0].reference,'62220001');assert.equal(posts[0].amount,5000)
 assert.equal(vm.pendingTopup,null);assert.equal(vm.view,'detail')
}))
test('确认框打开期间换了账号：不提交，让父页面按新账号重新加载',()=>withUni(async()=>{
 const session={token:'staff-t1'},posts=[]
 const {vm,emitted}=openDetail(ROLE.manager,async(path,method)=>{if(method==='POST')posts.push(path);return detailOf()},session)
 vm.openTopup();vm.editor.amount='50'
 globalThis.uni.showModal=o=>{session.token='someone-else';o.success({confirm:true})}
 await vm.submit()
 assert.deepEqual(posts,[]);assert.equal(emitted.filter(e=>e[0]==='access-change').length,1)
}))
test('财务能充值但没有“作废”；本人账户、停用账户不显示充值按钮而是说明原因',()=>withUni(async()=>{
 const {vm}=openDetail(ROLE.finance,async()=>detailOf())
 vm.detail=detailOf({actions:{canTopUp:true,topUpBlocked:'',canVoid:false}})
 let html=await render(vm)
 assert.ok(html.includes('给客户充值'));assert.ok(!/>作废</.test(html),'财务看不到作废按钮')
 vm.detail=detailOf({actions:{canTopUp:false,topUpBlocked:'本人的账户请由其他同事充值',canVoid:false}})
 html=await render(vm)
 assert.ok(!html.includes('>给客户充值<'));assert.ok(html.includes('本人的账户请由其他同事充值'))
 vm.openTopup();assert.equal(vm.view,'detail','服务器说不能充值时按钮点不开')
 vm.detail=detailOf({storeBalanceUsable:false})
 html=await render(vm);assert.ok(html.includes('经营设置里的「余额付款」现在是关闭的'))
}))
test('客服看档案：没有余额、充值记录和按钮',()=>withUni(async()=>{
 const {vm}=openDetail(ROLE.service,async()=>detailOf())
 const {money,topups,...withoutMoney}=detailOf({actions:{canTopUp:false,topUpBlocked:'',canVoid:false}});vm.detail=withoutMoney
 const html=await render(vm)
 assert.ok(html.includes('余额和充值记录只有店长和财务能看到。'))
 for(const hidden of ['给客户充值','门店充值记录','门店余额（拿货、零售都能用）'])assert.ok(!html.includes(hidden),hidden)
}))
test('店长作废：写原因、确认后提交到这笔登记，作废后用返回的最新档案',()=>withUni(async()=>{
 const posts=[];const fresh=detailOf({topups:[{...detailOf().topups[0],state:'void',stateLabel:'已作废'}]})
 const {vm}=openDetail(ROLE.manager,async(path,method,body)=>{if(method==='POST'){posts.push([path,body]);return {repeated:false,detail:fresh}}return detailOf()})
 vm.openVoid(vm.detail.topups[0]);vm.editor.reason='错'
 assert.ok((await render(vm)).includes('作废原因只留在店里的记录里；客户的余额明细只显示“门店充值登记有误，已更正”。'),'作废表单说明原因不给客户看（复核 B15-6）')
 await vm.submit();assert.equal(vm.formError,'请填写2至300字作废原因');assert.deepEqual(posts,[])
 vm.editor.reason=' 金额填错 ';await vm.submit()
 assert.deepEqual(posts,[['/staff/manage/topups/31/void',{reason:'金额填错'}]]);assert.deepEqual(vm.detail,fresh);assert.equal(vm.detail.topups[0].state,'void')
 const finance=openDetail(ROLE.finance,async()=>detailOf()).vm;finance.openVoid(finance.detail.topups[0]);assert.equal(finance.view,'detail','没有作废权限的人打不开作废表单')
}))

// ---------- 下单与顾客余额 ----------
test('下单页：拿货单也能打开“使用门店余额”，报价和提交都把它带给服务器',()=>{
 const s=source('../components/ShopScreen.vue')
 assert.ok(s.includes('<view v-if="paymentMethod!==\'credit\'&&rules.walletPaymentEnabled!==false&&walletAccount.available>0" class="line"><text>使用门店余额（可用¥{{money(walletAccount.available)}}）</text>'))
 assert.equal(s.split('useBalance:this.useBalance&&this.rules.walletPaymentEnabled!==false').length-1,2)
 assert.ok(!s.includes('useBalance:this.useBalance&&!this.partnerPurchase'))
 assert.ok(!s.includes('使用原余额'));assert.ok(!s.includes('拿货订单只能微信付款'))
 assert.ok(s.includes('拿货订单用微信付款，也可以用门店余额抵扣；不能使用优惠券、积分、活动和小程序充值余额'))
 // 小程序充值余额仍然只给零售单
 assert.match(s,/useOnlineBalance:this\.useOnlineBalance&&this\.channel==='C'&&!this\.partnerPurchase/)
})
test('顾客的余额页把门店充值写清楚',()=>{
 const s=source('../components/WalletPanel.vue')
 assert.ok(s.includes('<view class="heading">门店余额</view>'));assert.ok(s.includes("store_topup:'门店充值',store_topup_void:'门店充值作废'"))
 assert.ok(s.includes('下单时打开「使用门店余额」抵扣，零售和拿货都能用'))
})
