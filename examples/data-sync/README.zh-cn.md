# 增量数据同步 — Viat 1.1.0

[English](README.md) · [完整中文指南](../../src/content/docs/zh-cn/applications/data-sync.md)

可部署的工作流、认证端点以及**默认禁用**的每小时调度。本地惰性适配器读取只追加 SQL 变更日志，执行确定性的版本 upsert/墓碑，仅当整页成功才推进持久 checkpoint。源、目标与 checkpoint 刻意共用一个专属 SQLite 资源；不是跨服务事务，也不是虚构 ERP 连接器。

## 默认仅进行本地单元验证

在本目录：

```sh
python3 -I validate.py
```

验证器仅依赖标准库，加载**实际部署**的 `project/scripts/setup.py` 和 `sync_batch.py`，在临时 SQLite 中执行它们的 SQL，注入假 Viat 上下文，检查 checkpoint 前失败、回滚/重启、最终数据、旧版本重放不倒退与并发调用。不运行 YAML 引擎、调度、HTTP 或真实 broker。协调者已在阻断网络与子进程调用的离线 harness 中成功运行此验证器。

`fixtures/input.json`、`fixtures/expected.json` 给出精确分页与最终行；完整 schema/种子在可部署 setup 中，不是另写一套玩具模型。`case.json` 固定服务端 1.1.0，无额外 Python 包依赖。

## 部署前置条件

按指南准备匹配版本的 CLI/已激活非生产服务、登录，创建**全新隔离**的 `example-data-sync` 项目及 API key authorizer/用户，在 `VIAT_SQLITE_ROOTS` 内挂载专属服务端文件，并显式初始化。先修改资源路径；完成授权步骤后从 `project/` 执行：

```sh
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"data-sync-isolated-db"}'
```

保留 `--only`：排除 `meta` 才不会裁剪单独创建的 authorizer。调度和端点类别仍会镜像裁剪，所以不能复用已有项目。端点 target 用 `ref`，调度 target 用 `name`。push 不发布、不执行初始化；默认不启用调度。

## 限制、恢复与清理

批大小为整数 1–100，默认 2。序列必须只追加且按**提交可见顺序**增长；不能在 checkpoint 以下补写/修改历史。同一 SQLite BEGIN IMMEDIATE 内整页失败会全部回滚；外部适配器必须依靠目标幂等、outbox 和对账，而不是虚构分布式原子性。补偿必须追加更高序列的新事件，不能改旧历史。

指南包含精确断言、调度显式启用、错误/权限和停流清理。仅删除本例的 `sync-hourly`、记录的端点/密钥**行 UUID**，以及新项目内拥有的用户、authorizer、工作流、脚本、资源。资源删除保留文件；经证据保留和依赖核查后，仅清理精确的新文件及 sidecar。1.1.0 不支持项目 DELETE。目前仅协调者离线单元验证通过；真实 HTTP/broker/调度验收、部署、服务、联网与清理仍未验证。
