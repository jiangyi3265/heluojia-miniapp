# 首页定制与护肤方案

当前结构（2026-09-25）：`pages/skincare/index` 是小程序启动页，名称为「首页」，只展示轮播、定制问卷和报告入口。原 `pages/index/index` 保留完整商城内容，名称改为「商城」。所有主页面统一使用 `MainTabbar.vue`，顺序为「首页、商城、分类、购物车、我的」。首页内部不再有独立的产品页、个人中心或另一套底栏。

问卷与报告属于首页定制流程，底栏仍选中「首页」；生成分析和查看方案时隐藏底栏，使用页面返回入口。原商城的商品、价格、订单、支付、登录与角色权限逻辑保持原样；员工普通启动仍按既有规则进入工作台。主导航使用 `reLaunch`，问卷草稿和报告继续按访客或登录账号保存，切换主页面后可恢复。

本次验证：174 项自动测试通过；H5 和微信小程序编译通过。浏览器实际点击五个主入口、恢复问卷草稿、完成 13 题、生成分析、查看报告与方案、往返原商品详情，并检查 320/390/430/1280 像素布局，未发现页面脚本错误或横向溢出。记录在 `.local/navigation-qa/result.json`。使用本地模拟接口，没有提交真实订单、咨询或付款；本轮导航修改尚未上传微信。

## 使用流程

首页轮播 → 立即定制 → 性别（可选择暂不填写）→ 年龄（可跳过）→ 1–3 项护理目标 → 肤感与护理习惯等 10 个后续问题 → 称呼 → 整理问卷与核对商品 → 护肤分析报告 → 商品方案 → 原有商品详情或产品体验咨询。

## 问卷分析补全（2026-09-24 后续）

用户进一步指定要「分析的东西」，增加 `SkincareAnalyzing.vue`、`SkincareInsights.vue` 与 `services/skincare-analysis.js`。

- 提交称呼后进入分析页：整理回答、解读方向、请求当前商品和价格。加载动画只在真实商品请求进行期间显示，没有人为添加等待或伪造进度百分比。完成后点击「查看我的分析报告」。无拍照、皮肤检测或外部 AI 接口。
- 报告从质地、日常搭配、护理频率与单品预算四个方向解读，每条都有对应的用户回答。作息不作为皮肤问题的诊断依据；年龄和性别不用于推断皮肤状态。
- 选品和解读共用质地规则：主动清爽偏好优先，其次偏油/混合、偏干/夜间目标，其他以中润供比较。偏干但选择清爽时说明两者的取舍；缺货换成其他质地时明确提示。
- 精简偏好限制为精华水与面霜；标记已经在用的同类产品。逐款比较单品价格与填写预算，显示符合、高于或低于所选区间，不改价、不承诺匹配效果、不强制过滤商品。300 元以内按含 300 元处理；其余选择按页面展示的区间边界比较。预算不代表整套价格。
- 每项护理目标均有基于回答的方向、依据、质地/搭配说明和下一步建议。圆环只展示目标数量，不生成没有检测依据的皮肤健康分数；参考程序的内部算法未获取，不声称与其评分一致。
- 商品加载失败时仍保存并允许查看问卷解读，可重试商品；生成过程中返回会保留草稿，迟到的响应不会覆盖报告；更换登录状态时不保存为新账号的报告。旧版本报告可读取，并提示缺少的习惯资料。问卷仍保存在本机，咨询与分享的数据范围不变。

当前验证：141 项自动测试通过；H5 与微信小程序编译通过。浏览器重新点测完整 13 题、报告和咨询全流程；分析专项覆盖真实加载/完成、连续点击、四项解读、目标切换、预算和已有产品、退出生成、请求失败及重试、持久化、账号变化及 320/390/430/1280 像素布局。记录为 `.local/skincare-qa/analysis-result.json`、`survey-result.json` 和 `qa-result.json`。均为本地及模拟接口测试，未提交真实咨询、订单或支付，未发布微信。

## 首页定制流程补全（同日后续）

用户明确只复刻「首页 → 立即定制」后，继续在参考小程序中实际选择保湿方向，发现目标选择后总题数从 3 变成 13。已逐题查看全部后续问题、单选/多选、必选提示、姓名卡。示例选择停在提交前，没有向参考商家提交新的报告或体验申请。

新增定制页现在直接进入问卷，选择目标后显示 13 题：性别、年龄、护理目标、日常肤感、护理经历、作息、在用产品（多选）、日常护理频率、到店习惯、单品预算、步骤偏好、选购因素（多选）、咨询需求（多选）。文案依据赫洛嘉现有产品与客服能力调整，不复制没有依据的诊断或疗效承诺。

- 重新测试清除当前草稿，保留已生成的报告，并提供取消；上一题保留答案；中途离开后可继续原来的题目。
- 在用产品的「暂时没有固定使用的产品」与其他选项互斥。未答必选题不能继续，目标限制 1–3 项。
- 报告展示护理习惯摘要和可展开的完整回答记录。步骤偏好选择精简时，沿用精华水加一款面霜的选品方式；商品价格继续使用服务器返回值。预算只作为用户的选购偏好展示，不改变价格。
- 新报告为版本 2，旧版本 1 仍可查看。编辑旧报告时转为新版问卷草稿，补完问题后再生成。草稿及报告仍按本机访客或登录账号隔离。
- 性别、年龄、详细作息等回答保存在本机，不加入客服咨询的发送内容；咨询仍只发送经客户同意的联系方式、肤感与护理目标。

新增逻辑在 `services/skincare-survey.js`，新增 7 个测试覆盖问卷必填、互斥多选、版本恢复与迁移、隐私字段排除及精简推荐。共 134 项 Node 测试通过。浏览器检查完整 13 题、返回、重填/取消、中途恢复、报告记录、原商品页、登录衔接、咨询失败重试和账号隔离；320/390/430/1280 像素布局无横向溢出。当前流程记录为 `.local/skincare-qa/survey-result.json` 和更新的 `qa-result.json`。

参考用户提供的九张截图，采用浅灰背景、浅蓝按钮、线条图标、留白、纸张称呼卡和报告环形图。品牌、产品和文案使用赫洛嘉。环形图仅展示客户自选的护理偏好，不生成皮肤评分、检测结果或治疗建议。没有虚假的分析等待过程。

首屏标题与产品图整体横向循环轮播，每 4.5 秒自动切换一次；可左右滑动或点击底部圆点切换。三组内容分别为「了解肤感，为你而选」「三种润泽，随心选择」「了解自己，为你定制」。下方的定制按钮固定在轮播区域外，页面隐藏时暂停自动播放。

## 按实际参考小程序补全设计（2026-09-24 历史记录）

下面记录初版设计过程。其中独立五栏导航、首页下方系列介绍与独立「我的」已在 2026-09-25 按用户要求移除，以本文开头的统一导航结构为准。

通过原生 Windows 微信实际浏览了用户打开的「嘉瑟琳调肤体验实验室」，查看首页轮播与下方品牌介绍、产品侧边分类、定制介绍与首题、已有报告的分项解读、体验方案的完整商品长页、体验弹窗及个人中心。未提交参考商家的问卷或体验申请。

- 新增页面内的五个导航保持同一套灰白、浅蓝和线条图标样式。「产品」展示精华水、凝润乳、面霜、精华油侧边分类，以及清润/中润/倍润质地浏览。选品使用真实的在售品牌编码、图片、价格，缺货商品有提示，点商品仍进入原详情。
- 首页按一屏主视觉调整照片与按钮比例，下方增加系列入口、可切换的三种面霜质地介绍。加入一张定制流程说明轮播。
- 前一版曾增加定制介绍；后续按用户指定的首页定制流程改为直接进入问卷。性别和目标使用圆形图标，后续问题使用圆点选项。年龄选填、多选上限、草稿和纸张称呼卡保留。
- 报告增加可点击的目标卡、固定在顶部的偏好切换、三个有序内容段、质地/搭配切换、展开护理笔记和关联商品。图表表示客户选了几项偏好，不编造皮肤评分或疗效百分比。
- 方案包含独立轮播、两列单品清单、逐款大图和现有商品说明、品牌系列介绍、可展开常见问题。方案隐藏本功能底部导航，把底部空间留给体验咨询按钮；顶部返回报告。
- 「我的」提供本机偏好、报告与方案入口，另有原商城个人中心、原客服与清除本机护理记录入口。所有新内容限定在新增的护肤功能内。

静态编辑文案在 `services/skincare-content.js`，产品分类组件在 `components/SkincareCatalog.vue`，针对参考界面的样式在 `pages/skincare/skincare-polish.css`。不增加数据库、诊断服务、线下承诺或支付规则。

## 数据与规则

- 问卷、草稿和最新报告保存在本机，按访客或已登录账号区分；报告页可以清除。未主动咨询时不向后台上传问卷。年龄不参与商品匹配，也不会随咨询发送。
- 商品读取现有 `/shop/app/bootstrap?channel=C`，沿用服务器返回的价格。只匹配现有赫洛嘉产品编码；旧数据仅回退到完全一致的产品名称。只推荐当前启用、未归档、开放零售且有库存的单品，不创建新商品。
- 偏油、混合或「清爽肤感」优先清润面霜；偏干或「夜间滋养」优先倍润面霜；其他情况优先中润。优选款缺货时从其他在售质地中选择，页面展示实际商品质地。
- 「精简护肤」只提供精华水和一款面霜；其余方案可包含乳液；「润泽光采」或「夜间滋养」可增加精华油。页面明确单品按需选择，用法参照包装说明。
- 商品卡片跳转原有 `product` 页，后续购买继续走原来的流程。
- 体验入口为咨询，不承诺免费样品、疗效或固定回访时限。填写姓名、手机号、城市并主动勾选同意后，经登录调用现有 `/shop/app/support/messages`。后台现有「人工客服」接收，客户在「帮助与客服 → 查看商城历史留言」查看。
- 咨询按钮有提交锁。网络结果不确定时锁定内容，使用同一 requestKey 重试，由现有客服接口去重。关闭或成功后清除内存中的联系方式；联系方式不另行保存到本机问卷。
- 未登录咨询先跳原登录页，问卷以一次性、15 分钟有效的本机记录衔接登录返回；普通切换账号不会显示前一个账号的报告。
- 微信分享只分享公共介绍页及现有推广来源，不包含姓名、年龄、问卷或联系方式。复制偏好仅包含肤感与选项。

## 改动范围

新增定制页、分析与报告组件、静态图片和服务辅助代码。`pages.json` 将定制首页放到首位，原商城路由保留；`ShopScreen.vue` 和定制页共用新增的 `MainTabbar.vue`；`HomeModules.vue` 去掉重复的定制入口。员工启动识别同步支持新首页。无需数据库迁移或新增后台接口。

## 图片来源

`static/skincare/hero.jpg` 是使用内置 imagegen 工具，参考现有赫洛嘉精华水、清透霜、臻萃油照片生成的主题展示图，导出为 810×1080 JPEG（约 105 KB）。只用于本次新增页面和入口；商品清单与详情仍使用现有商品图。

生成提示词原文：

> Create one premium skincare storefront hero photograph using the THREE attached authentic HELUOJIA product photos as exact product appearance references: tall cobalt-blue silver pump toner, shorter cobalt-blue silver pump face cream, cobalt-blue white dropper facial oil. Preserve each actual blue bottle silhouette, silver cap, white typography and Chinese 赫洛嘉 branding faithfully; no redesign or extra brand. Portrait 3:4 composition on a seamless very light neutral cool-gray studio surface (#eeeeee), directional sunlight upper left with elegant realistic soft shadows. The three bottles arranged diagonally like an editorial flat-lay: tall toner at back upper left tilting from lower-left to upper-right, facial oil middle right, short cream foreground lower center tilted similarly. Make the bottles large, clean separation, asymmetrical harmonious arrangement, realistic commercial product photography. Nearly overhead camera, bottles resting on ground. Product grouping occupies center 80% of frame, ample quiet gray padding on all sides, background reaches edges. No added text, NO headline, NO buttons, no frames, no interface, no plants, no stones, no floating impossible objects, no watermark. This image will sit below a separate HTML heading on a pale gray mobile page.

原始生成图保留于 `C:/Users/jiangyi/.codex/generated_images/01a0d142-f9e9-7601-b39d-748f7d7570bc/exec-f1ca02aa-e07e-4e1f-b916-53cb46939ab9.png`。页面使用项目内的 JPEG，不依赖该外部路径。

## 验证与发布边界

轮播第二张配图 `static/skincare/hero-creams.jpg` 同样由内置 imagegen 制作，参考现有清透霜、柔护霜、奢润霜产品照片，压缩为 810×1080 JPEG。生成提示词：

> Create a premium photorealistic HELUOJIA skincare carousel product photograph, portrait 3:4. Use these three input photographs as exact product references: clear cream, gentle care cream, rich cream. Preserve their real identical cobalt-blue short cylindrical pump bottle shapes, transparent blue caps, silver HELUOJIA collars and 赫洛嘉 packaging typography, distinguish their actual labels. Show exactly these THREE cream bottles lying flat on a seamless pale neutral gray studio surface #eeeeee, staggered in an elegant parallel diagonal arrangement sloping bottom-left to top-right, near overhead camera, strong realistic soft directional shadows toward bottom-right. One at upper-left, one middle-right, one lower-left, all entire bottles visible and no overlap. Bottles together occupy central 75% of canvas, leave generous 12% empty padding at both top and bottom so mobile cropping never cuts a bottle. Same refined light-gray photography art direction as a luxury skincare mini-program. Natural silver highlights, rich cobalt glass, crisp authentic product details. No extra text outside packaging, no interface, buttons, headline, circles, plants, rocks, other brands or watermarks.


初版验证：127 项 Node 测试通过（新增 12 项），H5 与微信小程序编译通过。Playwright 在本地构建产物上检查首页入口、三步表单、生成报告、不同偏好选品、原商品链接、模拟登录衔接、咨询校验、连续点击、失败重试、留言历史、记录恢复、账号隔离及 320/390/430/1280 像素布局。

浏览器使用本地模拟接口和只读抓取的公开商品快照，未发送真实客服留言、订单或付款。代码与本地预览已完成；本次未上传微信开发版、未提交审核、未部署线上服务。仍需微信真机确认原生登录衔接、分享卡片与软键盘体验。

本地核验记录和截图位于 `.local/skincare-qa/`，不随源代码发布。推荐及表单规则位于 `services/skincare.js`，新页面的 CSS 均有作用域。

轮播补充核验：H5 和微信小程序重新编译通过。Playwright 实测自动切换、最后一张循环回首张、双向触摸滑动、圆点切换、定制按钮位置稳定、进入问卷及 320/390/430/1280 像素显示，浏览器无报错。记录为 `.local/skincare-qa/carousel-result.json`。
