import {createRequire} from 'node:module'
import {defineConfig,loadEnv} from 'vite'
const require=createRequire(import.meta.url)
const uni=require('@dcloudio/vite-plugin-uni').default
export default defineConfig(({mode})=>{
 const apiBase=process.env.VITE_SHOP_API_BASE||loadEnv(mode,process.cwd(),'VITE_').VITE_SHOP_API_BASE
 return {plugins:[uni()],define:apiBase?{'import.meta.env.VITE_SHOP_API_BASE':JSON.stringify(apiBase)}:{},server:{host:'127.0.0.1',port:15174},build:{sourcemap:false}}
})
