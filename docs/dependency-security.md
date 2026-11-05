# 前端依赖维护（2026-09-26）

本轮保留全部 DCloud 包的同一版本 `3.0.0-5020420260812001` 和 Vue 3.4.21，修补其锁定的旧间接依赖。`package-lock.json` 必须与 `package.json` 一起提交、发布。

Vite 升到 6.4.3。DCloud 插件仍声明精确的 Vite 5.2.8 peer dependency，因此使用 `overrides.vite: "$vite"` 统一依赖树。这是本项目已验证的兼容组合，并非 DCloud 官方兼容承诺。升级其他 DCloud 版本时应重新核对并尽可能移除不再需要的覆盖项。

其他覆盖项包括 Babel、Intlify、PostCSS、压缩/图片解析、WebSocket 和 Express；原依赖树中有已公开安全问题。保留 Intlify 9.x、Express 4.x 等同一主要接口；esbuild 使用 0.25.12，phin 使用 3.7.1。实际解析版本以锁文件为准。

验证命令：

```sh
npm ci --registry=https://registry.npmjs.org
npm audit --registry=https://registry.npmjs.org
npm test
npm run build:h5
npm run build:mp-weixin
npm run dev:h5
```

还须检查 H5 实际登录、顾客页面、手机管理分包和开发服务器，以及微信开发者工具/真机。编译通过不等于微信原生支付、相机或正式发布验收通过。不要使用 `npm audit fix --force` 提议的旧 DCloud 0.x 版本。

安全修复依据：[Vite Windows 文件访问修复公告](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)。审计使用 npm 官方仓库；镜像不支持 audit 时不能视作扫描通过。
