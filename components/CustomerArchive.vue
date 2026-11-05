<template>
  <view class="archive">
    <view class="archive-intro">
      <text class="eyebrow">我的商城档案</text>
      <text class="heading">一个账号，查看自己的购物权益</text>
      <text class="intro-copy">填写称呼和联系电话后，个人购物和分销拿货的资料都在这里查看。</text>
    </view>

    <view class="archive-form">
      <text class="section-title">基本信息</text>
      <text class="field-label">怎么称呼您</text>
      <input v-model="name" class="archive-input" maxlength="40" placeholder="填写称呼或姓名" />
      <text class="field-label">联系电话</text>
      <input v-model="phone" class="archive-input" type="number" maxlength="11" placeholder="填写11位手机号" />
      <text class="field-hint">用于商家联系您。手机号未经核验，不会自动关联其他账号。</text>
      <text v-if="error" class="form-error" role="alert">{{ error }}</text>
      <button class="ui-button primary save-button" :disabled="busy" @click="save">{{ busy ? '正在保存…' : '保存档案并查看权益' }}</button>
    </view>

    <view v-if="hasArchive" class="identity-section">
      <text class="section-title">当前账号的权益</text>
      <view class="identity-row">
        <view class="identity-text"><text class="identity-name">个人购物 <text class="identity-code">C端</text></text><text class="identity-detail">{{ retailDescription }}</text></view>
        <button class="ui-button outline identity-action" @click="go('grades')">查看优惠</button>
      </view>
      <view class="identity-row">
        <view class="identity-text"><text class="identity-name">分销商拿货 <text class="identity-code">B端</text></text><text class="identity-detail">{{ partnerDescription }}</text></view>
        <button class="ui-button outline identity-action" @click="go(partnerTarget)">{{ partner?.enabled ? '去拿货' : partnerTarget === 'partner' ? '查看拿货' : '查看申请' }}</button>
      </view>
      <!-- 企业采购已停止（不能再下新单）：只对有过企业资料的顾客说明一句，不再显示“去采购/查看资格”（复核 FC-42） -->
      <view v-if="member.enterprise_access || ['pending', 'approved', 'rejected'].includes(member.enterprise_state)" class="identity-row">
        <view class="identity-text"><text class="identity-name">企业采购 <text class="identity-code">已停用</text></text><text class="identity-detail">企业采购已停止，不能再下新单；如有以前的企业订单，仍可在“我的订单”里查看。</text></view>
      </view>
      <text class="identity-note">这里仅显示当前登录账号的资料。若原商城订单没有出现，请先在登录页验证原账号并绑定微信，或联系客服。</text>
    </view>
  </view>
</template>

<script>
import { request, go } from '../services/shop.js'
import { partnerTierSummary } from '../services/partner-tier.js'

export default {
  props: { member: { type: Object, required: true }, partner: { type: Object, default: null } },
  emits: ['saved'],
  data() { return { name: this.member.nickname || '', phone: this.member.contact_phone || this.member.phone || '', retail: null, busy: false, error: '', justSaved: false } },
  computed: {
    hasArchive() { return this.justSaved || !!this.member.contact_phone },
    retailDescription() {
      const rate = Number(this.retail?.membership?.rate || 10000)
      return rate < 10000 ? `已享 ${rate / 1000} 折消费优惠` : '可在商城购买商品，充值优惠以实际开通情况为准'
    },
    partnerDescription() {
      if (this.partner?.enabled) return `已开通，专属拿货享 ${Number(this.partner.rate) / 1000} 折`
      const kind = partnerTierSummary(this.partner || { applicationState: this.member.distributor_state, distributor: this.member.distributor_state === 'approved' }).kind
      if (kind === 'blocked') return '专属拿货已暂停，如有疑问请联系客服'
      if (kind === 'waiting') return '已通过审核，可以分享商品赚佣金；登记加盟款后即可拿货'
      return this.member.distributor_state === 'pending' ? '申请审核中' : '尚未开通，可查看申请条件'
    },
    partnerTarget() {
      return this.partner?.enabled || this.member.distributor_state === 'approved' ? 'partner' : 'distribution'
    },
  },
  mounted() { this.loadRetail() },
  methods: {
    go,
    async loadRetail() { try { this.retail = await request('/retail-recharge') } catch { /* Other archive details remain available. */ } },
    async save() {
      if (this.busy) return
      const name = this.name.trim(), phone = this.phone.trim()
      this.error = !name ? '请填写称呼或姓名' : !/^1[3-9][0-9]{9}$/.test(phone) ? '请填写正确的11位手机号' : ''
      if (this.error) return
      this.busy = true
      try {
        await request('/account/profile', 'POST', { nickname: name, contactPhone: phone, avatar: this.member.avatar || '' })
        this.justSaved = true
        this.$emit('saved')
        uni.showToast({ title: '档案已保存', icon: 'success' })
      } catch (error) {
        this.error = error?.message || '保存失败，请稍后重试'
      } finally { this.busy = false }
    }
  }
}
</script>

<style scoped>
.archive{padding:18px 16px 40px;color:var(--shop-text, #2b424f)}
.archive-intro{padding:20px 4px 24px}
.eyebrow{display:block;color:var(--shop-muted, #59727f);font-size:12px;letter-spacing:2px;margin-bottom:10px}
.heading{display:block;font-size:23px;line-height:1.35;font-weight:650}
.intro-copy{display:block;color:var(--shop-muted, #59727f);font-size:14px;line-height:1.7;margin-top:12px}
.archive-form,.identity-section{background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:12px;padding:20px 18px;margin-bottom:16px}
.section-title{display:block;font-size:17px;font-weight:600;margin-bottom:18px}
.field-label{display:block;font-size:14px;margin:14px 0 8px}
.archive-input{box-sizing:border-box;width:100%;height:48px;background:var(--shop-background, #f3f8fb);border:1px solid var(--shop-border, #d5e6ee);border-radius:7px;padding:0 13px;font-size:16px;color:var(--shop-text, #2b424f)}
.archive-input:focus{border-color:var(--shop-control, #417c9a)}
.field-hint,.identity-note{display:block;color:var(--shop-muted, #59727f);font-size:12px;line-height:1.7;margin-top:11px}
.form-error{display:block;color:#a64639;font-size:13px;margin-top:12px}
.save-button{display:block;width:100%;margin-top:20px}
.identity-row{display:flex;align-items:center;gap:12px;padding:16px 0;border-top:1px solid var(--shop-border, #d5e6ee)}
.identity-text{flex:1;min-width:0}
.identity-name{display:block;font-size:15px;font-weight:600}
.identity-code{font-size:11px;color:var(--shop-muted, #59727f);font-weight:400;margin-left:4px}
.identity-detail{display:block;font-size:12px;color:var(--shop-muted, #59727f);line-height:1.6;margin-top:5px;overflow-wrap:anywhere}
.identity-action{flex-shrink:0;font-size:12px;line-height:34px;padding:0 10px;min-width:70px}
.identity-note{border-top:1px solid var(--shop-border, #d5e6ee);padding-top:14px;margin-top:4px}
@media(max-width:360px){.archive{padding-left:12px;padding-right:12px}.archive-form,.identity-section{padding-left:15px;padding-right:15px}.identity-action{min-width:64px;padding:0 8px}}
</style>
