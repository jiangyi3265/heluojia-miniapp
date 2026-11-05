import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {caseMayRefund} from '../pages/staff/services/staff-management.js'
import {recentRefundDuplicate} from '../pages/staff/services/staff-customers.js'

// 第 16 批补缺口：页面实测发现的手机管理端小缺陷
const panel=readFileSync(new URL('../pages/staff/components/StaffManagementPanel.vue',import.meta.url),'utf8')
const customers=readFileSync(new URL('../pages/staff/components/StaffCustomers.vue',import.meta.url),'utf8')

test('S-08b：只有“仅退款 + 通过申请”“退货退款 + 完成验收”这一步才会发起退款，确认框才写“本次可能发起 ¥… 退款”',()=>{
 assert.equal(caseMayRefund('refund','approve'),true)
 assert.equal(caseMayRefund('return','inspect'),true)
 assert.equal(caseMayRefund('return','approve'),false,'退货退款“通过申请”只是请顾客寄回')
 for(const action of ['reject','close','reship','received','extend'])for(const type of ['refund','return','exchange','resend'])assert.equal(caseMayRefund(type,action),false,type+' '+action)
 assert.equal(caseMayRefund('exchange','inspect'),false);assert.equal(caseMayRefund('exchange','approve'),false)
 assert.match(panel,/caseMayRefund\(editor\.row\.type,body\.action\)\?' 本次可能发起 '/)
 assert.doesNotMatch(panel,/\['refund','return'\]\.includes\(editor\.row\.type\)&&\['approve','inspect'\]/)
})

test('C16：门店余额退款也提醒 10 分钟内同样金额的退款（放弃后再登记时防重复退款），与充值一致；不同金额、超过 10 分钟的不提醒',()=>{
 const now=Date.parse('2026-10-05T10:20:00+08:00'),rows=[{amount:1000,createdBy:'王店长',createdAt:'2026-10-05 10:12'},{amount:3000,createdBy:'李店长',createdAt:'2026-10-05 09:00'}]
 assert.equal(recentRefundDuplicate(rows,1000,now),'10 分钟内已给这位客户退过一笔 ¥10.00，登记人 王店长，请确认不是重复退款。')
 assert.equal(recentRefundDuplicate(rows,2000,now),'','金额不同不提醒')
 assert.equal(recentRefundDuplicate(rows,3000,now),'','超过 10 分钟不提醒')
 assert.equal(recentRefundDuplicate(rows,0,now),'');assert.equal(recentRefundDuplicate(null,1000,now),'')
 assert.match(customers,/if\(this\.editor\?\.kind==='refund'\)return recentRefundDuplicate\(this\.refunds,this\.refundFen,Date\.now\(\)\)/)
 assert.match(customers,/退回剩下的预存"\/>\r?\n\s*<text v-if="duplicate" class="notice-block">\{\{duplicate\}\}<\/text>/)
})

test('K08b：库存调整明确失败（例如仓库刚被停用）时表单写明原因，同时在后台重读列表；结果不确定时不重读（保留原样重试）',()=>{
 assert.match(panel,/if\(module==='stocks'&&!this\.uncertain&&!ACCESS\.test\(message\)&&getToken\(\)\)reread=true;/,'登录失效或没有权限时交给上层重新读身份，不再重读列表')
 assert.match(panel,/else if\(!this\.editor\|\|reread\)this\.restartRefresh\(\)/)
})
