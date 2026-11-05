# heluojia-miniapp

赫洛嘉商城微信小程序与 H5 用户端。

## 项目简介

提供商品浏览、下单、售后、积分兑换、钱包提现、加盟分销与会员资料功能，并包含员工移动工作台、客户管理及发货入口。

## 技术栈

JavaScript、Vue 3.4、uni-app、Vite 6、微信小程序、H5；Node.js >=20.19.0。

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| heluojia-backend | 后端服务 | [heluojia-backend](https://github.com/jiangyi3265/heluojia-backend) |
| heluojia-admin | 管理后台 | [heluojia-admin](https://github.com/jiangyi3265/heluojia-admin) |
| heluojia-miniapp | 微信小程序 / H5 | [heluojia-miniapp](https://github.com/jiangyi3265/heluojia-miniapp) |

## 快速启动

准备 Node.js 22 和 npm。

```bash
npm ci
cp .env.example .env.local
npm run dev:h5
```

将 `.env.local` 中的 `VITE_SHOP_API_BASE` 配置为后端地址。执行 `npm run build:h5` 或 `npm run build:mp-weixin`。H5 发布 `dist/build/h5`；微信开发者工具导入 `dist/build/mp-weixin`，配置 `manifest.json` 的 AppID 与合法域名。AppSecret 仅存后端。测试：`npm test`。

## 项目结构

`pages/`：商城与员工页面；`components/`：业务组件；`services/`：接口及业务规则；`static/`、`styles/`：素材与样式；`scripts/`：构建入口；`tests/`：测试。

## 简历描述示例

参与 uni-app 小程序与 H5 开发，实现会员购物、订单售后、钱包提现及员工移动工作台，支持多端业务交互。

## 配置与数据

源码仓库不包含真实环境配置、密钥、业务数据库备份和上传数据，请单独安全备份。
