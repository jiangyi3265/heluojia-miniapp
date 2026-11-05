<template>
  <!-- H5 uses native overflow so a removed uni scroll-view cannot run its queued mount callback. -->
  <!-- #ifdef H5 -->
  <view class="horizontal-scroll"><slot /></view>
  <!-- #endif -->
  <!-- #ifndef H5 -->
  <scroll-view scroll-x style="height:auto;white-space:nowrap"><slot /></scroll-view>
  <!-- #endif -->
</template>
<script>export default {options:{virtualHost:true}}</script>
<style scoped>
@import '../styles/component-base.css';

.horizontal-scroll { overflow-x: auto; white-space: nowrap; }
</style>
