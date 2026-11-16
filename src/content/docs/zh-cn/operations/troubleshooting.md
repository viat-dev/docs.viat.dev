---
title: 健康检查与故障排查
description: 结合存活、就绪、指标和执行证据排查启动、路由、认证、运行时、存储与集成问题。
doc_id: operations.troubleshooting
verified_release: '1.1.0'
channel: stable
---

# 健康检查与故障排查

从**故障边界**开始查,不要随机调大环境变量。权限:容器/主机日志要运维
权限,项目日志要成员资格,全平台审计仅平台 Owner。**命令均为未执行的只读
模板**(另有明确变更流程的除外)。不要把秘密、原始负载或 provider 响应贴
进公开报告。

## 探针契约

| 路径 | 认证 | 返回与"不代表"的能力 |
| --- | --- | --- |
| `GET /healthz` | 公开,激活门禁之外 | 200 `{"status":"ok"}` 只表示 HTTP 在服务——不查数据库、激活、运行时/依赖或版本。 |
| `GET /readyz` | 公开,激活门禁之外 | 数据库成功返回 200 `{"status":"ready","pool":"ok"}`;已有连接都忙可为 `pool:saturated`。空池/空闲连接检查限时 2 秒,失败 503 `{"status":"not_ready","check":"database"}`;原始数据库详情只在日志。 |
| `GET /metrics` | 配置非空才挂载,需精确 bearer | 未配置 404;已挂载而 token 错/缺失 401。在激活门禁之外——须靠网络保护。 |
| `GET /version` | 平台认证 | 返回本节点版本,不是匿名指纹入口。 |

用法:`healthz` 判断**是否重启**;`readyz` 判断**依赖路由**(按你的拓扑)。
重启应用修不好 PostgreSQL 宕机;"忙"不自动等于"未就绪"——饱和要单独
监测。许可锁定时探针绿是**刻意**的:管理员要能进激活页。

```sh
docker ps --filter name=viat-server
docker inspect --format '{{.State.Status}} {{.RestartCount}}' viat-server
docker logs --since 15m viat-server
curl --fail-with-body "$BASE/healthz"
curl --fail-with-body "$BASE/readyz"
curl --fail-with-body "$BASE/version" -H "Authorization: Bearer $TOKEN"
```

用实际容器名与含前缀的可信 HTTPS `BASE`。命令只观察、不修复;支持包里
不要复制活跃凭据。镜像健康探测 liveness,**不是** /ui——关闭 UI 不该
被判为不健康。部署脚本等的明文 `/auth/config` 是另一种检查,可能误判
内置 TLS。

## 现象 → 操作

| 现象 | 首查边界 | 恢复方向 |
| --- | --- | --- |
| 监听前退出 | 必填数据库/主密钥、bind、TLS 对、迁移、后端构造 | 保留启动错误;修环境/网络/权限,不要先改项目脚本 |
| `db connect` / PoolTimedOut | 数据库不可达、连接总额、锁、依赖故障 | 先看 PostgreSQL 与全实例连接预算,不盲加并行 |
| `db migrate` / 校验和错 | schema/数据/权限漂移 | 停止重启循环、备份并演练;**不删迁移校验和** |
| 老 Docker 无法建线程 EPERM | seccomp/clone3 兼容 | 升级 runtime/libseccomp;bullseye 只过渡,不永久 unconfined |
| `403 license_required` | 未激活/过期 | 有权限的管理员提交有效官方激活;探针正常不矛盾 |
| 管理 API 401 | 平台凭据错/过期,或误用运行 key | 正常管理登录/PAT;**不要**换 JWT/主密钥"修登录" |
| 项目操作 403 | 成员/项目角色、scope、gate | 核对身份、PAT scope 与项目角色;平台角色 ≠ 项目授权 |
| 编辑后端点 404 | slug/方法/路径/前缀错或未发布;轮询能力错 | 查已发布路由与 URL;授权发布或修能力,不猜管理绕过 |
| 429 / Retry-After | 身份/端点配额或失败退避 | 遵守重试;查代理 IP 与 Redis/本地范围;不全关防暴破 |
| 413 | 代理、2 MiB 缓冲/文本、文件/资源上限 | 定位是哪条路径的预算;用受支持的流式/上传,不发明全局 body 参数 |
| READY/构建超时 | 缺 uv/bun、包源/CA/代理、缓存权限、冷装 | 查环境/构建输出;持久缓存、修镜像源/属主、合理构建预算 |
| 池/通道/队列 503 | 饱和或失败环境门禁 | 查预算/通道、队列年龄与瓶颈;有界背压 |
| 脚本超时/代理 504 | 执行上限、代理空闲期限、下游阻塞 | 关联请求;断连后目标仍可能已提交,重试前确认 |
| 文件 PermissionError | 容器路径、UID、属主、只读挂载 | 精确修权限/UID;不 chown 全主机或 spool |
| 解密失败 | 原主密钥错、缺历史后端、Vault 过期或秘密丢失 | 恢复正确读权限/原密钥;**不覆盖密文** |
| 私有 CA TLS 失败 | 实际客户端的信任/链/主机名 | 装批准信任、修证书链;没有通用 CA 变量,不全局关校验 |
| 历史行空/搜索 409 | 外部写后端或保留期 | 查目标后端/sink;摘要可能仍在 PostgreSQL |
| 告警 200 但没收到 | delivered:false、边沿已记、无许可/设备 | 看 body/last_error;修好后**批准再测试**,不自动重发未变边沿 |
| 异步轮询 404 | 能力错/缺失、项目/ID 错或已过期 | 用返回的能力头并按权限查任务;404 是防枚举设计 |
| 磁盘增长 | 日志/负载/spool/产物/target/uv/业务数据 | 先分清责任与生命周期;删除可能毁审计/恢复证据 |

默认值见[配置](../configuration/overview.md);操作细节见[运行](runs.md)、
[日志](logs.md)、[告警](alerts.md)、[审计](audit.md)、[保留](retention.md)、
[容量](capacity.md)、[TLS/反代](tls-proxy.md)。

## 认证与发布误区

- 端点认证/绑定的修改通常**发布后**才影响调用方。authorizer 由最近声明
  **替换**上级;授权 gate **累积**到 override 边界。草稿测试的权限/数据
  路径与发布调用不同;`uses` 共享依赖 live 读取,不随快照回滚。
- 未定位到有效规则前,不能靠改公开端点"修复"认证。
- bootstrap 密码只创建**不存在的** Owner,不重置已有用户;MFA
  required/enrollment 属于密码登录握手,不应压掉 401;保留恢复码并用
  已文档化的管理员重置。
- CLI 默认按工作目录向上找 `.viat`;`VIAT_CONFIG_DIR` 可固定目录。MCP
  的 legacy token **不自动等于** CLI 新的 access/refresh 格式。

## 有序恢复与报告

1. 保留证据:UTC 时间、版本/镜像、状态/错误码、不含 token 的路径、
   请求/运行 ID 与相关脱敏日志。
2. 用隔离项目/无害夹具重现;真实 provider/消息/设备行为须批准。
3. 一次只改一个已确认的原因;同时观察探针、实际功能与副作用;重启前
   先安排排空/重试。
4. 怀疑数据/schema 损坏或秘密丢失时,**停止破坏性尝试**——先做
   [隔离恢复](backup-restore.md),再替换生产。
5. 移除 debug/夹具、撤销泄露凭据、记录已验证与未验证的边界,按政策保存
   事件证据。

使用产品不应要求读源码才能发现必填项;超出文档接口的行为应标为不支持/
未验证——不发明变量,不发明保证。
