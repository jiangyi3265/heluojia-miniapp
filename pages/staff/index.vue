<template><StaffWorkbench ref="bench"/></template>
<script>
import StaffWorkbench from './components/StaffWorkbench.vue'
// Not shareable on purpose: the workbench shows customer names, phones and addresses.
export default {components:{StaffWorkbench},data(){return{shown:false}},onShow(){this.$nextTick(()=>{if(this.shown)this.$refs.bench?.refresh();this.shown=true})},async onPullDownRefresh(){try{await this.$refs.bench?.refresh()}finally{uni.stopPullDownRefresh()}},onReachBottom(){this.$refs.bench?.loadMore()}}
</script>
