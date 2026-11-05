<template><ShopScreen ref="screen" screen="product" :query="query"/></template>
<script>
import ShopScreen from '../../components/ShopScreen.vue'
import {pageShare,pageTimeline,showPageSharing,hidePageSharing} from '../../services/share.js'
import {promotionQuery} from '../../services/shop.js'
export default {components:{ShopScreen},data(){return {query:{},shown:false}},onLoad(q){this.query=promotionQuery(q)},onShow(){showPageSharing(this,'product');this.$nextTick(()=>{if(this.shown)this.$refs.screen?.refresh();this.shown=true;this.$refs.screen?.resume()})},onShareAppMessage(event){return pageShare('product',this.query,event,this.$refs.screen)},onShareTimeline(){return pageTimeline('product',this.query,this.$refs.screen)},onHide(){hidePageSharing(this);this.$refs.screen?.suspend()},onUnload(){hidePageSharing(this);this.$refs.screen?.suspend()},async onPullDownRefresh(){try{await this.$refs.screen?.refresh()}finally{uni.stopPullDownRefresh()}}}
</script>
