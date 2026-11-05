<template>
  <view class="support-contact">
    <SupportEntrance :refresh-tick="refreshTick" />
    <view v-if="member" class="history-entry">
      <button class="ui-button outline" @click="showHistory = !showHistory">{{showHistory ? '收起商城留言' : '查看商城历史留言'}}</button>
      <text class="history-hint">微信客服消息请在微信会话中查看，之前的商城留言保留在这里。</text>
    </view>
    <SupportPanel v-if="member && showHistory" :active="active" />
  </view>
</template>
<script>
import SupportEntrance from './SupportEntrance.vue'
import SupportPanel from './SupportPanel.vue'
export default {
  components: { SupportEntrance, SupportPanel },
  props: { member: { default: null }, active: { type: Boolean, default: true }, refreshTick: { default: 0 } },
  data() { return { showHistory: false } }
}
</script>
<style scoped>
@import '../styles/component-base.css';
.history-entry{margin:0 24px 24px}.history-hint{display:block;margin-top:12px;font-size:13px;line-height:1.7;color:var(--shop-muted, #59727f)}
</style>
