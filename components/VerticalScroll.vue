<template>
 <!-- #ifdef H5 -->
 <view ref="viewport" class="vertical-scroll" :style="[{height},viewportStyle]" @scroll="nativeScroll"><slot/></view>
 <!-- #endif -->
 <!-- #ifndef H5 -->
 <scroll-view :style="[{height},viewportStyle]" scroll-y :scroll-top="scrollTop" @scroll="$emit('scroll',$event)" @scrolltolower="$emit('scrolltolower')"><slot/></scroll-view>
 <!-- #endif -->
</template>
<script>
export default {options:{virtualHost:true},props:{height:{type:String,default:'100%'},viewportStyle:{type:Object,default:()=>({})},scrollTop:{type:Number,default:0}},emits:['scroll','scrolltolower'],watch:{scrollTop(value){
 // #ifdef H5
 const node=this.$refs.viewport?.$el||this.$refs.viewport;if(node&&Math.abs(node.scrollTop-value)>1)node.scrollTop=value
 // #endif
}},methods:{nativeScroll(event){const node=event.target;this.$emit('scroll',{detail:{scrollTop:node.scrollTop}});if(node.scrollHeight-node.clientHeight-node.scrollTop<80)this.$emit('scrolltolower')}}}
</script>
<style scoped>
@import '../styles/component-base.css';
.vertical-scroll{overflow-y:auto;overscroll-behavior-y:contain;height:100%}</style>
