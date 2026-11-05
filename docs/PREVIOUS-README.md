# heluojia-miniapp

赫洛嘉商城用户端，使用一套 Uni-app 源码构建微信小程序和 H5。

## 项目简介

提供商品浏览、购物车、微信登录、零售下单、微信支付、订单流转、退款售后、发票、收货地址、优惠券、积分、客服、商品分享和分销商申请。审核通过的分销商可从“专属拿货”入口购买；账号身份不会自动改变零售商品标价。

当前 `pages.json` 注册 50 个页面路由。企业采购旧页面用于历史兼容，新业务统一通过分销商申请入口。商品、订单与用户数据来自后端，运营人员在管理后台维护。

## 技术栈

- Uni-app 3，DCloud 编译器版本 `3.0.0-5020420260812001`
- Vue 3.4.21、JavaScript、Vite 5.2.8
- 微信小程序原生登录、支付与分享接口；同源组件编译为 H5
- Node.js 22 LTS、npm 锁文件；不依赖固定的本机 HBuilderX 安装路径

已验证目标为微信小程序和 H5；不将 manifest 中预留的平台配置等同于已交付原生 App。

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| heluojia-backend | 后端 API、业务逻辑、数据库与部署资料 | [heluojia-backend](https://github.com/sickelgroupe-create/heluojia-backend) |
| heluojia-admin | 商品、订单、库存及财务运营管理后台 | [heluojia-admin](https://github.com/sickelgroupe-create/heluojia-admin) |
| heluojia-miniapp | 微信小程序与 H5 用户端 | [heluojia-miniapp](https://github.com/sickelgroupe-create/heluojia-miniapp) |

## 快速启动

启动 `heluojia-backend` 后，在本仓库根目录执行：

```bash
npm ci
cp .env.example .env.local
npm run dev:h5
```

把 `.env.local` 中的 `VITE_SHOP_API_BASE` 设为实际 API 地址。本机 H5 开发可用 `http://127.0.0.1:18080`，访问 `http://127.0.0.1:15174`。真机需要可访问的 HTTPS 域名，不能使用手机自身的 `127.0.0.1`。

微信小程序构建：

```bash
npm run build:mp-weixin
```

在微信开发者工具导入 `dist/build/mp-weixin`。更换小程序时修改 `manifest.json` 内 `mp-weixin.appid`，并与后端的微信 AppID 保持一致。在微信平台配置 request、uploadFile、downloadFile 合法域名，由有权限的成员上传体验版。

H5 生产构建：

```bash
npm run build:h5
```

部署 `dist/build/h5` 全部内容。小程序和 H5 均通过 `.env.local` 设置 API 域名，不加 `/prod-api`；图片地址由服务层按 API 域名解析。更多域名、证书、登录和支付配置见 [后端部署说明](https://github.com/sickelgroupe-create/heluojia-backend/blob/main/deploy/README.md)。

Windows 可用 `Copy-Item .env.example .env.local` 代替 `cp`。

## 项目结构

```text
pages/            50 个页面路由入口
components/       商城页面及复用业务组件
services/         API、会话、支付、分享、订单入口与上传封装
styles/           公共视觉样式
static/           客户端静态资源
scripts/uni.mjs   可跨目录运行的 Uni-app 构建入口
pages.json        页面路由和窗口设置
manifest.json     微信 AppID、平台与编译配置
App.vue/main.js   应用启动入口
```

## 配置与验证

真实 `.env`、`project.private.config.json`、`node_modules`、`dist`、`unpackage` 和密钥均不提交。`package.json` 的 `private: true` 用于防止误发布 npm 包，与 GitHub 仓库公开状态无关。

微信 AppSecret、商户证书、APIv3 密钥只配置在后端。构建成功后，真机验收应覆盖登录、零售下单、分销拿货、取消订单、支付退款、库存与流转、商品分享及发票入口；开发者工具不能替代所有真机能力。

## 简历描述示例

参与 Uni-app 商城小程序与 H5 开发，以 Vue 3 公共组件和服务层实现商品购买、订单售后、分销拿货、客服及发票等用户流程。对接微信登录、支付和分享能力，并优化订单状态展示与真机交互体验。
