export const invoiceStates={requested:'待开票',rejected:'待修改资料',issued:'已开票',adjustment_required:'退款后待调整',cancelled:'申请已取消'}
export function invoiceAmount(order){return Math.max(0,Number(order?.amount||0)-Number(order?.refunded_amount||0))}
export function canApplyInvoice(order,canCompany){return !!order?.paid_at&&invoiceAmount(order)>0&&(order.channel==='C'||!order.company_id||canCompany)}
export function invoiceStatus(invoice){return invoice?.status==='issued'&&Number(invoice.issued_amount)===0?'票据已调整处理':invoiceStates[invoice?.status]||'未申请'}
export function invoiceHint(order,canCompany){if(!order?.paid_at)return '付款后可申请发票';if(!invoiceAmount(order))return Number(order?.amount||0)>0?'订单已全额退款，暂无可开票金额':'这笔订单没有现金实付（如积分兑换），无需开票';if(!canApplyInvoice(order,canCompany))return '企业订单请由企业负责人或财务申请';return '支持个人或企业抬头，财务开票后可查看文件'}
