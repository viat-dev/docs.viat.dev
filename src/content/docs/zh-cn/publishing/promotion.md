---
title: "跨环境提升项目"
description: "用仓库/包迁移审查后的草稿，准备目标秘密、测试并有意发布。"
doc_id: publishing.promotion
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.export", "cli.import", "cli.push", "cli.pull", "cli.publish.apply"]
---

# 跨环境提升项目

Viat 1.1.0 **没有原生 promote 命令、命名环境流水线或把不可变快照复制到另一实例的 API**。提升指仓库或 export/import 移动审查后的**草稿定义**，准备目标设置/秘密/数据，再在那里发布。server release 与 CLI/client 版本独立，需匹配稳定契约和 test-host。export 不是快照历史归档，也不是上游 DB/文件备份。

本页流程源码推导、**未执行**，未创建项目/解包/搬秘密/测试/构建/网络/供应商调用；远端写入、迁移、真实资源测试、发布、清理前须明确授权。

## 权限和前提

- 来源：平台登录/项目成员可普通读取，完整 export 可能还需 queue/WS-trigger 等 editor-gated 读取，不能承诺 Operator 导出全部对象。
- 目标：平台登录、创建新项目能力；已有资产需内容编辑权，项目/auth 高权限设置和发布需 Owner/Admin；import 多阶段，不是全远端原子事务。
- 完整审查后的 checkout 或可信 viatpkg，明确目标 slug/server/session、隔离 staging 资源、兼容 schema/data/migrations、所需语言工具链和外部凭据供应。
- 安全本地目录，保护 .viat session、包、源码/plain 配置和手动秘密；导出占位值**不是凭据**。

## 携带与不携带

| 面 | 行为 |
| --- | --- |
| scripts/workflows/endpoints/trees | 草稿定义，folder 是身份；不搬 active snapshot version/revision history。 |
| resources | plain 配置和秘密占位，不搬可复用秘密，来源 hostname 未必适合目标。 |
| schedules/watches/queue_triggers/ws_triggers | 仓库支持的 live 配置；创建/启用可在**端点发布前**开始活动，先查 enabled/root/broker/feed/default。 |
| IM | chat 同步 im/accounts 资源账号、im/triggers 和支持的 groups；内联/QR 账号 pull 跳过、push 缺失不删，目标需知情重新配置/扫码，复制 trigger 可引用不可移植账号。 |
| 授权/仓库 meta | 仅 viat.yaml/repo 表达字段，不是所有控制台设置/客户端身份；model version/破坏性变更另有 guard/审批。 |
| 运行产物/数据 | 不含通用业务 DB 行、受管文件字节、执行历史、用户凭据、设备注册、供应商绑定、外部排队消息、任意 watch 文件、服务器部署配置，需另计划。 |
| 测试 | 本地 checkout 可携带 tests/cassettes，不应假定 export/import 携带所有非 repo fixture 或服务器保存用例，目标须显式核对。 |

pull 读取远端**草稿**，不是已发布内容。若目标是“当前线上版本”，先协调 draft-vs-snapshot，否则成功 export 也可能部署未发布工作。普通脚本 uses 可作为冻结闭包审查，workflow step uses（含嵌套）仍 live，见[快照边界](snapshots.md)。

## 包路径：导出与导入

虚构语法示例、未执行：

```sh
viat export source-demo --output source-demo.viatpkg
viat import source-demo.viatpkg --as staging-demo
```

export 重新 pull 指定/选中源到临时 staging，打 gzip-tar viatpkg 并清 staging；--output 默认 `./<slug>.viatpkg`，可覆盖已有文件；--only 按 CLI 重复/逗号选择支持 kind，不是依赖求解器。即使无秘密也应私密保存包。

import 必填 FILE，可选 --as slug（否则包 slug）、--only、--prune 默认 false、--update-resources 默认 false。缺项目则创建，否则 upsert；**不会选择该项目，不发布、不执行 DB migration**。先确认 server/login，当前 selected project 不能代替 --as。

资源导入有意保守：

- 新的需秘密资源因无凭据会跳过并报告，安全补目标凭据后再评估定义。
- 已有带秘密资源默认**整体保持**，不只是保密字段，避免来源 host/port 导向目标凭据。
- --update-resources 明确允许更新其导入配置，不会变出缺失凭据，使用前复查目标地址。
- skipped/kept 汇总**不会自动让 import 非零**，成功也可能缺依赖/保留旧值。
- --prune 显式删除表达范围内的远端独有项，默认非破坏 upsert，与普通 mirror push 不同。

输出为进度/导入项目/pending publish/skipped secret/kept resource，不是 publish 响应；无专用 --json 成功结构。失败前可能已写入早期阶段，重试前查当前状态，无统一 undo token/事务取消。

## 仓库路径与破坏边界

checkout 含 viat.yaml、scripts/workflows/resources、`endpoints/<tree>/`、各 trigger 目录、IM、crate 和支持的 migrations。每环境用专用 session/config，pull/project diff/push 前确认 selected server/project；session 发现不改变 CWD。不要向未审查脏目录 pull 并期待保留所有本地工作。

普通 push 不是统一非破坏：脚本/工作流/资源通常 upsert，endpoint/trigger/meta 镜像可删远端缺失项，authz model guard/migration、system 资产排除另有规则。部分 --only/checkout 不自动安全。$secret 导出 marker 会被剥离，$keep 仅保留已有顶层 plain 值，支持位置的 $secret: 资源引用又不同，都不能供给缺失目标秘密。见[完整同步参考](../cli/sync.md)。

不要虚构 watch/queue/WS/IM 独立 CLI，支持的是 repo/API。live trigger 定义保留 enabled false，直到目标资源、DLQ/ack timeout、watch roots、供应商身份已验；扫码账号保护不表示复制 trigger 可安全异地启用。

## 测试、发布、恢复

1. 审查导入状态/diff，补目标资源/秘密、刷新 schema，以支持命令执行明确审查后的 DB/authz migration。迁移与 import/push 分离，先备份数据、查 rollback 兼容。
2. 授权必要本地 DB/工具链后跑 fake suite/endpoint fixture；服务器 gate 访问真实资源，须先确保隔离。fixture 内部两个 acknowledgement true，不证明 gate 通过。
3. 发布前显式选择**目标**项目；`viat publish plan --json` 是 dirty 叶说明，不预约；逐项阅读 warning，不复制 test-host 的统一豁免。
4. 获批后 `viat publish apply --require-tests --yes --json` 先本地 script suite，再服务端 gate；不会自动跑 endpoint fixtures，接受的 pending/失败 build 仍可 exit 0，须看 env 与实际授权路由。
5. 按类别逐一明确启用 live triggers，查 identity/input/order/retry/idempotency 和下游观测；供应商接受发送不是回执。

完整 publish 字段与门禁差异见[快照](snapshots.md)。读取项目成功不证明最终端点权限正确。import/push 失败先比目标真实行再重试；流量错误经批准 unpublish/[rollback](rollback.md)，但不能恢复覆写资源/数据/live 模块或撤回 trigger 效果。重试包/发布不是 exactly-once 编排，外部动作须业务键。

清理时 pause schedule、禁用 watch/queue/WS/IM，处理在途 tasks/连接/broker unacked，撤销邀请/测试凭据、取消发布一次性端点，再经授权删除隔离项目/配置/数据。本地包/目录删除不会清远端；保留审计/revision 证据，只删自己的虚构包/staging，不能为了 demo 一致而 prune 生产。

依据：`crates/viat-cli/src/commands/sync.rs` 与 export/import 实现、`repo/{resources,endpoints,schedules,watches,queue_triggers,ws_triggers,im}.rs`；`crates/viat-api/src/handlers/{publish,snapshots}.rs`。本任务未验证真实跨实例迁移/供应商重连，仍属部署验收。
