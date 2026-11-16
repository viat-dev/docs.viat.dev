---
title: "跨环境提升项目"
description: "用仓库/包迁移审查后的草稿，准备目标秘密、测试并有意发布。"
doc_id: publishing.promotion
verified_release: '1.1.0'
channel: stable
contract_ids: ["cli.export", "cli.import", "cli.push", "cli.pull", "cli.publish.apply"]
---

# 跨环境提升项目

把一个 Viat 项目从一个实例搬到另一个实例(开发 → staging → 生产),做法是:
**移动审查后的草稿定义**、在目标侧补齐设置/秘密/数据,然后在那里发布。

先接受三个事实,后面所有步骤都由此展开:

1. 1.1.0 **没有原生 promote 命令、命名环境流水线,也没有把不可变快照复制到
   另一实例的 API**。"提升"是仓库或 export/import 的草稿迁移。
2. server release 与 CLI/client 版本独立,目标端需匹配稳定契约与 test-host。
3. export 不是快照历史归档,也不是上游数据库/文件备份。

> [!WARNING]
> 本页流程源码推导、**未执行**,未创建项目/解包/搬秘密/测试/构建/调用网络或
> 供应商。远端写入、迁移、真实资源测试、发布与清理前,必须获得明确授权。

## 权限和前提

- **来源端**:平台登录/项目成员即可普通读取;完整 export 可能还需要
  queue/WS-trigger 等 editor 级读取,不能承诺 Operator 能导出全部对象。
- **目标端**:平台登录与创建新项目的能力;改已有资产需内容编辑权,
  项目/auth 高权限设置与发布需 Owner/Admin。import 是多阶段过程,不是
  全远端原子事务。
- **材料**:完整审查后的 checkout 或可信 viatpkg;明确目标 slug/server/
  session、隔离的 staging 资源、兼容的 schema/数据/migrations、所需语言
  工具链与外部凭据供应。
- **本地**:安全目录,保护 `.viat` 会话、包、源码/plain 配置与手动秘密;
  导出中的占位值**不是凭据**。

## 什么会跟着走,什么不会

| 面 | 行为 |
| --- | --- |
| scripts/workflows/endpoints/trees | 草稿定义,folder 是身份;**不搬** active snapshot 版本与 revision 历史。 |
| resources | plain 配置与秘密占位;**不搬**可复用秘密,来源 hostname 未必适合目标。 |
| schedules/watches/queue_triggers/ws_triggers | 仓库支持的 live 配置;创建/启用可在**端点发布之前**就开始活动,先核对 enabled/root/broker/feed/default。 |
| IM | 同步 im/accounts 资源账号、im/triggers 与支持的 groups;内联/QR 账号 pull 跳过、push 缺失不删,目标需知情后重新配置/扫码;复制的 trigger 可能引用不可移植账号。 |
| 授权/仓库 meta | 仅 viat.yaml/repo 能表达的字段,不是全部控制台设置/客户端身份;model version 与破坏性变更有独立 guard/审批。 |
| 运行产物/数据 | **不含**业务数据库行、受管文件字节、执行历史、用户凭据、设备注册、供应商绑定、外部排队消息、任意 watch 文件、服务器部署配置——需另行规划。 |
| 测试 | 本地 checkout 可携带 tests/cassettes;不要假定 export/import 携带所有非 repo fixture 或服务器保存用例,目标端须显式核对。 |

`pull` 读取的是远端**草稿**,不是已发布内容。如果你要的是"当前线上版本",
先协调 draft-vs-snapshot 差异,否则成功的 export 也可能部署了未发布的工作。
依赖审查口径:普通脚本 `uses` 可按冻结闭包审查;workflow step uses(含嵌套)
仍为 live,见[快照边界](snapshots.md)。

## 包路径:export 与 import

示例语法,未执行:

```sh
viat export source-demo --output source-demo.viatpkg
viat import source-demo.viatpkg --as staging-demo
```

**export** 重新 pull 指定/选中的源到临时 staging,打成 gzip-tar 的
viatpkg 后清理 staging。`--output` 默认 `./<slug>.viatpkg`,可覆盖已有文件;
`--only` 按 CLI 的重复/逗号语法选择 kind,不是依赖求解器。即使没有秘密,
包也应私密保存。

**import** 必填 FILE,可选 `--as`(缺省用包内 slug)、`--only`、
`--prune`(默认 false)、`--update-resources`(默认 false)。目标项目不存在
则创建,否则 upsert;**不会自动选择该项目,不发布、不执行数据库迁移**。
先确认 server/login;当前 selected project 不能代替 `--as`。

资源导入有意保守,逐条理解:

- 新增的需秘密资源因无凭据而**跳过并报告**;安全地补上目标凭据后再评估
  定义。
- 已有带秘密的资源默认**整体保持**(不只是保密字段),避免来源 host/port
  指向目标凭据。
- `--update-resources` 明确允许更新其导入配置,但不会变出缺失的凭据;
  使用前复查目标地址。
- skipped/kept 汇总**不会自动让 import 非零退出**——成功也可能缺依赖或
  保留旧值。
- `--prune` 显式删除表达范围内的远端独有项;默认是非破坏 upsert,这与
  普通 mirror push 不同。

输出是进度/导入项目/pending publish/skipped secret/kept resource,不是
publish 响应;没有专用 `--json` 成功结构。失败前可能已写入早期阶段:重试前
先查目标当前状态,没有统一的 undo token 或事务取消。

## 仓库路径与破坏边界

checkout 包含 viat.yaml、scripts/workflows/resources、`endpoints/<tree>/`、
各 trigger 目录、IM、crate 与支持的 migrations。每环境用专用 session/config;
pull/project diff/push 前确认 selected server/project;session 发现不改变
CWD。不要向未审查的脏目录 pull 并期待保留所有本地工作。

普通 **push 不是统一非破坏**操作:

- 脚本/工作流/资源通常 upsert;
- endpoint/trigger/meta 的镜像可删除远端缺失项;
- authz model guard、迁移与 system 资产排除另有规则;
- 部分 `--only`/checkout 组合不会自动安全。

`$secret` 导出 marker 会被剥离;`$keep` 仅保留已有顶层 plain 值;支持位置的
`$secret:` 资源引用又是另一回事——三者都不能凭空供给缺失的目标秘密。完整
规则见[同步参考](../cli/sync.md)。

不要虚构 watch/queue/WS/IM 的独立 CLI——支持的是 repo/API。live trigger
定义保持 `enabled: false`,直到目标资源、DLQ/ack 超时、watch roots、供应商
身份都验证过;扫码账号受保护不代表复制的 trigger 可以安全异地启用。

## 测试、发布、恢复

1. 审查导入状态/diff;补目标资源/秘密、刷新 schema,用支持命令执行明确
   审查后的 DB/authz 迁移。迁移与 import/push 分离,先备份、确认 rollback
   兼容。
2. 授权必要的本地 DB/工具链后跑 fake suite/endpoint fixture;服务器 gate 会
   访问真实资源,先确保隔离。fixture 内部两个 acknowledgement 为 true,不
   证明 gate 通过。
3. 发布前显式选择**目标**项目;`viat publish plan --json` 是 dirty 叶说明,
   不是预约;逐项阅读 warning,不要照搬 test-host 的统一豁免。
4. 获批后 `viat publish apply --require-tests --yes --json`:先本地 script
   suite,再服务端 gate;不会自动跑 endpoint fixtures;"接受的 pending/失败
   build"仍可 exit 0,必须看 env 与实际授权路由。
5. 按类别逐一启用 live triggers;核对 identity/input/order/retry/idempotency
   与下游观测——供应商接受发送不等于回执。

完整 publish 字段与门禁差异见[快照](snapshots.md)。能读取项目不代表最终
端点权限正确。import/push 失败时先比对目标真实行再重试;流量出错经批准
unpublish 或[回滚](rollback.md),但两者都**不能**恢复被覆写的资源/数据/
live 模块,或撤回 trigger 已产生的效果。重试包/发布不是 exactly-once 编排,
外部动作必须用业务键去重。

## 清理

pause schedule、禁用 watch/queue/WS/IM,处理在途 tasks/连接/broker
unacked;撤销邀请与测试凭据,取消发布一次性端点;再经授权删除隔离项目/
配置/数据。删除本地包/目录不会清理远端;保留审计与 revision 证据;只删
自己的示例包/staging——不要为了 demo 一致性而对生产使用 prune。

## 核验依据

契约源码 `03751a67`:`crates/viat-cli/src/commands/sync.rs` 与 export/import 实现、`repo/{resources,endpoints,schedules,watches,queue_triggers,ws_triggers,im}.rs`;`crates/viat-api/src/handlers/{publish,snapshots}.rs`。真实跨实例迁移与供应商重连未在本任务验证,仍属部署验收。
