<template><ShopScreen ref="screen" screen="sales-orders" :query="query"/></template>
<script>
import ShopScreen from '../../components/ShopScreen.vue'
export default {components:{ShopScreen},data(){return{query:{},shown:false}},onLoad(q){this.query=q},onShow(){this.$nextTick(()=>{if(this.shown)this.$refs.screen?.refresh();this.shown=true;this.$refs.screen?.resume()})},onHide(){this.$refs.screen?.suspend()},onUnload(){this.$refs.screen?.suspend()},async onPullDownRefresh(){try{await this.$refs.screen?.refresh()}finally{uni.stopPullDownRefresh()}}}
</script>
