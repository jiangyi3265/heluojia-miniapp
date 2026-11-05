<template><image :src="'/static/icons/'+name+(active?'-active':'')+'.svg'" :style="{width:size+'px',height:size+'px'}" mode="aspectFit" /></template>
<script>export default {props:{name:{default:'home'},size:{default:22},active:{default:false}}}</script>
