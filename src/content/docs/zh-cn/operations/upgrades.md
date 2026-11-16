---
title: 安全升级、验证与回退
description: 准备备份与兼容运行时，理解自动迁移和产物失效，并选择可靠回退方案。
doc_id: operations.upgrades
verified_release: '1.1.0'
channel: stable
---

# 安全升级、验证与回退

服务端升级是**部署/数据库操作**,不是端点发布。主机/数据库管理员批准,
项目负责人协调流量、调度与副作用。**所有命令都是未执行模板——编写本文
时没有拉镜像或修改服务。** 本手册核对版本为 1.1.0;未发布分支的功能不是
稳定版能力。

## 维护前

1. 记录:镜像摘要/版本、PostgreSQL 主版本、挂载、环境、激活期限、
   worker UID/GID 与所有副本。`viat version` 可报告 CLI/服务端信息——
   服务端与移动客户端版本**独立**。易变的 latest 不是回退记录。
2. 读目标版本的升级说明:schema/数据变更、保留名称冲突与必需操作。
   先解决冲突再迁移;**不能**改已应用 SQL 校验和绕过。
3. 创建并验证[完整恢复集](backup-restore.md):原主密钥、外部秘密引用、
   业务库/审计与文件。快照回滚不恢复平台 schema 或已删数据。
4. 用**精确目标镜像**在隔离恢复副本演练。启动会在 HTTP 之前自动执行
   平台迁移;没有通用自动降级迁移;耗时取决于数据与锁。
5. 验证:可信源依赖安装、uv 持久缓存、SDK/工具链/产物兼容、磁盘/PID
   ——普通镜像**不会**因为"开关打开"就有 Rust 编译器。
6. 规划流量隔离与任务排空:明确排队/运行/长任务/流式与重试的处置,
   按需停外部生产者。`SCHEDULER_ENABLED=false` 只关 cron,不停
   连接器/队列/告警。
7. 确认独立监控与匹配官方产物的有效激活码——许可过期时探针可正常,
   受保护端点仍 403。

## 单节点 Compose 示例

使用批准的项目与维护窗口。假设服务通过 `VIAT_TAG` 选镜像;直接固定
image 的部署改实际引用。保留所有卷/密钥,**绝不运行
`docker compose down -v`**。

```sh
# Only after backup/drain approval; this interrupts application service.
docker compose stop -t 60 viat
# Edit the approved environment/image selection to the target stable artifact.
# If testing installation of the documented release, the example tag is 1.1.0.
VIAT_TAG=1.1.0 docker compose pull viat
VIAT_TAG=1.1.0 docker compose up -d --no-deps viat
docker compose logs --since 10m viat
```

- 运行会访问所配置的镜像仓库——本文未执行。离线环境:转移经批准的精确
  镜像包、核对摘要/来源、受控导入;**不要执行不可信下载包里的脚本**。
- 产品的 `deploy-server.sh` 是另一回事:source 可信 shell 文件后**强删**
  旧同名容器再创建——不是优雅滚动/自动回滚,先读
  [输入与副作用](../configuration/network.md)。计划替换应先显式排空/
  停机,**不要假设 `rm -f` 会排空**。

## 恢复流量前验证

- 日志:数据库连接/迁移/校验和、秘密/日志后端、危险默认值、worker 身份
  与产物键。
- 探针:`healthz` 正常、`readyz` 反映数据库可用;`pool:saturated` 按设计
  可以返回 200——探针不证明激活或依赖预热。
- 功能:登录、读 `/version`、确认角色/成员/激活与**已发布的夹具端点**
  ——不用草稿测试证明发布行为;验证一个授权资源操作、无害秘密解密、
  文件读取与必需的工作流/流式/WebSocket,尽量用隔离目标。
- 周边:调度、队列年龄、环境与告警;真实通知/provider 测试须批准;实际
  检查外部指标/追踪/日志的接收——**配置存在不等于送达**。
- 基线:与升级前的错误率/延迟/资源比较;逐步恢复生产者/自动化并观察
  一个有代表性的负载周期。

## Rust 与依赖缓存

- 产物键 = 脚本/manifest + SDK + 工具链 + host protocol + target。
  升级可能让"看起来兼容"的旧二进制失效;只运行节点即使数据库/HTTP
  健康,也可能缺新产物。提前用匹配的 builder/CLI 准备,经批准的共享
  存储/上传分发。**不能**把旧文件改名成新 key 或绕过摘要校验。
- 混合架构/工具链与滚动阶段保持 `VIAT_RUST_S3_GC` **关闭**——单节点的
  live-set 可能把另一节点的产物误判为垃圾。本地 LRU 与 Cargo target
  另算。持久化的 `/home/viat/.cache/uv` 减少下载,但**不证明**改过的
  依赖都已构建;旧 root-owned 缓存迁到当前 worker HOME 后要验证属主
  接管——不要宽泛 chown 共享宿主树。

## 选择正确回退

| 故障 | 方向 |
| --- | --- |
| 未迁移、无数据副作用的非破坏配置错误 | 确认 schema 兼容后恢复旧配置/镜像并验证 |
| 迁移失败 | 保留日志/现场;在隔离环境确认事务与应用状态——不盲重跑、不删账本 |
| 已迁移但旧二进制不兼容 | 在隔离写入目标恢复批准的恢复集,或验证向前修复;**旧镜像本身不是回滚** |
| 错误的发布 revision | 由有发布权限者用项目/端点快照回滚——不回滚平台 schema、业务写入或 live uses 模块 |
| 缺 Rust 产物/依赖 | 补兼容产物/环境,不要先回退平台数据 |

> [!WARNING]
> 恢复数据库会丢掉恢复点之后的写入,还可能复活排队任务/已撤销凭据。
> 切换前:隔离旧节点 → 对账外部副作用 → 记录残留丢失。未经计划,不要让
> 新旧生产者同时操作相同目标。

完成后:保留证据、撤销临时夹具/配置,并把真实验证结果写回运维记录。
