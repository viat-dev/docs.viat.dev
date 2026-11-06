---
title: 备份并验证隔离恢复
description: 一致备份数据库、密钥与外部状态，仅向隔离目标恢复，并在依赖备份前证明可恢复。
doc_id: operations.backup-restore
verified_release: '1.1.0'
channel: stable
---

# 备份并验证隔离恢复

**本页每条命令都是未执行的运维模板，编写时没有停止、备份、恢复或连接任何服务。** 操作需要部署/数据库管理权限、数据负责人批准与维护窗口。使用前必须调整服务名、PostgreSQL 版本、账号、路径和恢复目标，不能直接粘贴到生产。

`viat pull` 或代码仓库**不是实例备份**：不含完整账号/会话、所有资源秘密、业务数据、运行历史、外部文件和部署配置。产品没有一条命令完成灾备/HA 的保证。

## 恢复集清单

| 项目 | 备份内容 | 原因 |
| --- | --- | --- |
| 平台 PostgreSQL | 一致数据库备份、所需角色/授权/扩展、版本；可另建受管 PITR/WAL | 平台状态、密文/引用、快照、队列、审计 |
| 原主密钥 | 独立受限秘密备份并演练获取 | SQL dump 单独无法解密 AES |
| JWT/配置/许可 | 受限环境、服务文件、镜像摘要、有效激活安排、TLS/私钥恢复政策 | 重建容器不恢复缺失配置；许可仍须有效 |
| Vault/AWS Secrets Manager | provider 支持的备份/版本恢复，历史名称/路径/mount 与读取身份 | 数据库只存引用；换写后端不迁移历史 |
| 业务数据库 | 一致备份，含审计表/trigger、文件元数据、迁移账本 | 不包含在平台库中，须协调业务恢复点 |
| 本地文件/SQLite | 文件、属主、权限；SQLite 合适的备份/检查点及必要 WAL | 在线部分复制未必是一致数据库 |
| S3/存储/产物 | 对象版本、桶配置/生命周期、必需可执行产物 | 字节不在平台 SQL；产物兼容取决于版本/target |
| 依赖/构建缓存 | 在线环境可重建，离线可能必需 | 重建需要可用源、工具链和时间 |
| 远端日志/导出 | 独立后端备份/保留与证据控制 | 平台 dump 不含新 ClickHouse/Loki 行 |

依据实测恢复时长和业务要求定义 RPO/RTO，不虚构产品保证。加密备份、分开保管密钥、限制权限、保留异地主机副本并验证可读。填好的 `.env` 和 dump 不能进入版本控制。

## Compose 平台备份示例

假设使用安装指南中的 viat/postgres 服务、viat 库/账号，位于批准的 Compose 项目目录，工具版本匹配且已安装。需要跨存储一致恢复点时，停止**共享恢复集的所有 Viat 副本和外部写入者**。按变更计划关闭入口/生产者并允许受支持的任务排空。pg_dump 自身可在线一致，但不能令多存储原子一致。

```sh
umask 077
mkdir -p backups/recovery-point
# This stops the application, not PostgreSQL; review the interruption first.
docker compose stop -t 60 viat
docker compose exec -T postgres pg_dump -U viat -d viat \
  --format=custom > backups/recovery-point/platform.dump
docker compose exec -T postgres pg_dumpall -U viat \
  --globals-only > backups/recovery-point/postgres-globals.sql
sha256sum backups/recovery-point/platform.dump \
  backups/recovery-point/postgres-globals.sql \
  > backups/recovery-point/backup.sha256
```

失败命令可能留下不完整文件；检查退出码、大小及 archive 目录，文件名/哈希本身不证明完整。pg_dumpall globals 需要适当权限，可含密码哈希，应按凭据保护。托管数据库采用批准的角色/导出机制，不假设超级用户。

写入者保持静默期间，按各存储支持的方法捕获外部状态，记录匹配时间/ID、配置与镜像摘要；完成后再恢复原应用：

```sh
docker compose start viat
```

不能用普通 tar 复制运行中的 PostgreSQL 数据目录。使用上方逻辑备份或 PostgreSQL 感知的物理/PITR。普通文件可在停止写入后保留属主/权限地快照/复制并记录哈希。SQLite 使用在线备份 API 或静默一致复制，不遗漏 WAL。S3 复制要含版本并证明与文件元数据对应，“桶存在”不够。

## 必须先在隔离恢复主机演练

使用专门主机/虚拟机，**没有能访问生产 provider/数据库的网络路径或凭据**，不挂生产目录，不开放公网监听。Docker `--internal` 网络只是纵深防御，不能当作所有主机/网络路径的万能防火墙。启动恢复应用前证明隔离：克隆的队列、调度、告警、聊天连接器可能自动行动；`SCHEDULER_ENABLED=false` 只关闭 cron。

准备新空目录、可信备份副本及**已经存在且获批准**的 PostgreSQL/应用镜像。不用生产容器/卷/服务名；下列显式 `--pull=never` 且不发布端口：

```sh
sha256sum -c backups/recovery-point/backup.sha256
docker network create --internal viat-restore-net
docker volume create viat-restore-pg
docker run -d --pull=never --name viat-restore-db \
  --network viat-restore-net \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=viat -e POSTGRES_DB=viat \
  -v viat-restore-pg:/var/lib/postgresql/data \
  postgres:17.4-alpine
docker exec viat-restore-db pg_isready -U viat -d viat
```

这里的 trust 认证**只限一次性、不发布端口的隔离演练，绝不是生产配置**。pg_isready 成功后才继续，启动期间可能需再次运行。使用匹配的 PostgreSQL 主版本/工具，或已单独验证的升级路径。审阅 globals，只恢复必需安全角色/授权；不把未审阅超级用户修改重放到共享集群。

```sh
docker exec -i viat-restore-db pg_restore \
  -U viat -d viat --no-owner --no-privileges --exit-on-error \
  < backups/recovery-point/platform.dump
docker exec viat-restore-db psql -U viat -d viat -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) AS projects FROM projects;' \
  -c 'SELECT count(*) AS users FROM platform_users;'
```

此演练使用 no-owner/no-privileges 有意不恢复原 ACL/属主，**不能证明生产权限已恢复**。真实恢复需审阅并重建批准权限。不要对已有数据库用 --clean 图省事。

## 验证应用、秘密与文件

在可信编辑器创建权限 0600 的 `recovery.env`，填以下**审阅过的夹具配置**及必要历史秘密读取后端。保留原主密钥，JWT 换成演练独立随机值，公共 URL 使用演练地址：

```dotenv
DATABASE_URL=postgres://viat@viat-restore-db:5432/viat
VIAT_MASTER_KEY=REPLACE_WITH_ORIGINAL_64_HEX_KEY
VIAT_JWT_SECRET=REPLACE_WITH_DRILL_ONLY_RANDOM_VALUE
VIAT_PUBLIC_URL=http://viat-restore:8080
VIAT_ALLOW_REGISTRATION=false
SCHEDULER_ENABLED=false
VIAT_BOOT_WARM=0
VIAT_RETENTION_ENABLED=false
VIAT_UI_ENABLED=false
```

这些开关**不关闭全部自动化**，主机隔离必需。恢复的激活仍可有效，后台任务仍可能运行，不能用许可锁定作安全措施。不要只为了结果正常而复制活跃 Vault/AWS 凭据；优先在隔离环境恢复 provider 夹具/只读副本，否则明确记录未验证。

```sh
docker run -d --pull=never --name viat-restore \
  --network viat-restore-net --env-file recovery.env \
  --pids-limit 512 --memory 4g \
  registry.cn-hangzhou.aliyuncs.com/viatdev/viat:1.1.0
docker logs viat-restore
docker exec viat-restore curl --fail --silent --show-error \
  http://127.0.0.1:8080/healthz
docker exec viat-restore curl --fail --silent --show-error \
  http://127.0.0.1:8080/readyz
```

先启动**同版本**，再考虑升级；启动会执行其内置迁移。示例刻意不挂文件/产物，应只挂**恢复副本**到所需路径并核对属主。检查至少包括：

- 项目/用户/快照数量及已知对象；经批准的登录、正确角色与有效激活。
- 通过恢复后端真正解密一个无害夹具秘密；探针不验证主密钥。
- 一个文件的预期哈希和业务记录/审计关联；SQL 导入不证明字节恢复。
- 兼容 Rust 产物或经证明的离线重建路径；依赖/缓存可访问。
- 明确盘点旧备份可能复活的排队/运行任务、已撤销会话/PAT，不重放生产副作用作验证。
- 记录所有未测外部 provider/后端及恢复耗时，不能把部分恢复称为完整。

## 清理与真实切换

经批准保留证据后，仅清理**演练专用名**。末条会销毁演练库，先确认名称：

```sh
docker rm -f viat-restore viat-restore-db
docker network rm viat-restore-net
docker volume rm viat-restore-pg
```

按备份政策处置 recovery.env/dump/导出；删文件并不保证所有存储安全擦除。真实恢复先隔离旧写入者，恢复批准的生产权限与秘密读取，协调重放风险/凭据，再分阶段开放入口和自动化。没有明确对账计划，不能让旧实例和恢复实例同时操作同一业务目标。参见[升级](upgrades.md)与[任务恢复](runs.md)。
