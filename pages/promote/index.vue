<template><ShopScreen ref="screen" screen="promote" :query="query"/></template>
<script>
import ShopScreen from '../../components/ShopScreen.vue'
import {pageShare,showPageSharing,hidePageSharing} from '../../services/share.js'
export default {components:{ShopScreen},data(){return {query:{},shown:false}},onLoad(q){this.query=q},onShow(){showPageSharing(this,'promote');this.$nextTick(()=>{if(this.shown)this.$refs.screen?.refresh();this.shown=true;this.$refs.screen?.resume()})},onShareAppMessage(event){return pageShare('promote',this.query,event,this.$refs.screen)},onHide(){hidePageSharing(this);this.$refs.screen?.suspend()},onUnload(){hidePageSharing(this);this.$refs.screen?.suspend()},async onPullDownRefresh(){try{await this.$refs.screen?.refresh()}finally{uni.stopPullDownRefresh()}}}
</script>
