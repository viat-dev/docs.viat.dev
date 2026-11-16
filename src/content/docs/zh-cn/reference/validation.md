---
title: 验证状态与可复现检查
description: 区分已完成的本地文档和示例检查，与尚未验收的提供商、设备及生产发布。
doc_id: reference.validation
verified_release: '1.1.0'
channel: stable
---

# 验证状态与可复现检查

本手册仍是**本地重建候选版**——不是已宣布正式发布的文档。清单覆盖、
构建成功、单元断言、真实服务端集成与外部提供商验收是**不同层次的
证据**。下述检查针对当前候选内容;修改源码、契约或案例后,需重跑对应
检查。

## 已经执行的检查

| 层次 | 证据 | 不能据此证明 |
| --- | --- | --- |
| 双语结构 | 两种语言覆盖必需主题/契约清单;检查配对元数据、源码链接/锚点、JSON 代码块与标记的共享源码片段 | 每句话的语义完整性或提供商政策 |
| 在线/离线产物 | Astro 静态构建、原始 Markdown、LLM 索引、公开路径/隐私模式扫描、mdBook,以及 `/_docs/`、`/viat/_docs/` 下的本地链接与资产;两种产物都含白名单示例源码 | 所有设备的浏览器交互、生产托管/DNS 或人工隐私审查 |
| CLI 语法 | 真实 Clap 解析器接受 385 条去重后的收集/显式 token 夹具(含已审阅的重定向);**不派发命令** | shell 重定向、实际文件/凭据、远端副作用或所有行内命令片段 |
| 工作流语法 | 六个应用工作流定义通过真实运行时的 `parse` 与 `validate` | 命名资产解析、调度或实际运行成功 |
| MCP 传输协议 | 真实 stdio 测试通过初始化、46 工具清单、JSON 文本块成功与 `isError` 失败外层 | 每条手册请求/预期值或每个工具的提供商副作用 |
| 首个端点 | 实际构建 CLI → 隔离 PostgreSQL/API → Python 草稿与已发布 HTTP 执行 → 日志 → 取消发布/删除 | 客户激活、MFA/SSO 或外部资源 |
| CMS | 真实 CLI push、授权引擎、独立临时业务 PostgreSQL/登录角色与 Python worker;覆盖匿名、读者、其他作者、伪造字段拒绝、编辑发布、草稿/公开隔离、重复冲突与自有对象清理 | 租户隔离、生产恢复/负载或任意原始 SQL 的安全 |
| 八个应用单元套件 | 执行实际部署函数/共享模块,用明确的 fake context 与本地临时数据;八个校验器全部通过,**无网络/子进程调用** | 真实 broker、调度器、提供商或设备行为 |

应用单元检查的边界:

- **论文摘要**:feed 解析、引用检查、动作开关与本地 claim 状态;未调用
  付费模型、实时 feed 或真实投递。
- **Home Assistant**:身份、动作、实体白名单与显式启用;未操作真实家居
  设备,也未确认 Home Assistant 的实际状态。
- **微信助理**:合成输入下的私聊 handler、绑定与发送者检查;未执行
  QR 登录、连接器轮询、真实回复或重新认证。
- **CMS**:纯策略回调逻辑之外,另有上表的真实栈验收。
- **实验室任务**:状态转换、重复/乱序处理与 dry-run 陷阱;真实本地
  adapter/工作流/回调集成需另验。
- **Webhook**:测试替身下的精确字节签名、SQLite ledger/projection 原子
  性与重复处理;**不能**证明真实 HTTP/raw-body/crypto-broker 准入。
- **数据同步**:本地 cursor/upsert/checkpoint/rollback——不是跨外部
  系统的分布式事务。
- **报表**:SQL、窗口、claim 与 fake relay 断言;未做真实 SMTP 提交或
  投递。

## 复现本地检查

在获准的文档检出中,备好指定 Node/Python 前提后:

```sh
npm ci
npm run build
npm run validate:examples
npm run build:book
npm run collect:cli
```

- `validate:examples` 的应用单元宿主拦截意外网络/子进程调用——但它
  **不是**恶意代码沙箱。独立 `acceptance.py` 或 adapter 程序要求各自
  的显式启用参数、隔离前提与操作人员决定;默认命令**不会**启动它们。
- CLI 收集器把 token 数组与报告写入 `exports/`;检查未解决的 shell
  情形——**不能**把遗漏命令算通过。把数组交给产品的开发者导出器:

```sh
scripts/export-doc-contracts.sh --output /tmp/handbook-contracts \
  --examples "$DOCS_CHECKOUT/exports/cli-examples.json"
```

  此命令在产品检出中运行,并配置编译/测试数据库;只解析参数、不派发
  命令、不读操作人员的 CLI 配置。
- 产品中默认忽略的跨仓库验收测试,要求显式提供 `DOC_EXAMPLE_ROOT`、
  `DOC_EXAMPLE_CLI`、已构建的匹配 CLI、uv/Python 与专用测试 PostgreSQL
  管理员;测试使用测试许可证状态,不需要厂商签名材料。CMS 另建随机命名
  的独立业务数据库/登录角色,登记归属后仅清理这些对象。显式要求验收时
  缺少前提会**失败**,不会静默变成成功。

## 正式发布前仍需完成

- 完成语义/安全审查并修复确认的问题——**不能**用解析器绿色掩盖已知
  限制。
- 仅在获准隔离基础设施上验证剩余 broker/提供商/设备集成;不默认发消息、
  产生模型费用、操作设备或清理真实数据。
- 验证浏览器搜索/语言切换、完整离线产品同步及所选发行产物的旧路径兼容。
- 固定文档/产品为干净且已审阅的提交,记录匹配证据与摘要;dirty 导出仍是
  候选。
- 仓库发布、托管、Cloudflare/DNS 变更与生产上线需明确批准。

发布门槛通过前,`publication_ready` 保持 false:预览成功或清单齐全
**不授权**改变此标志;`npm run check:release` 应拒绝不完整的验收记录。
