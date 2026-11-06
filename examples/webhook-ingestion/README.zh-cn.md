# 签名 Webhook 接入 — Viat 1.1.0

[English](README.md) · [完整中文指南](../../src/content/docs/zh-cn/applications/webhook-ingestion.md)

可直接推送的项目：API key 认证、原始字节 HMAC 验签、持久化 `event_id` 去重。事件账本与账户汇总在同一个 SQLite 事务内提交；不发送支付或消息，也不声称与外部服务构成原子事务。

## 文件与本地验证

- `project/viat.yaml`、`resources/`、`scripts/`、`endpoints/` 是完整部署仓库；真实表结构在 `project/scripts/setup.py`，处理逻辑在 `project/scripts/ingest.py`。
- `fixtures/event.json` 是精确合成输入字节，`fixtures/expected.json` 给出成功与失败预期。
- `sign_fixture.py` 仅使用**公开的演示假密钥**签署本地文件，不接受真实密钥、不联网。
- `case.json` 固定服务端 1.1.0，验证命令为 `python3 -I validate.py`。

在本目录运行：

```sh
python3 -I validate.py
```

验证器仅依赖标准库，加载实际部署代码及其 SQL，使用假 Viat/加密上下文和临时 SQLite，检查重放、冲突、过期/错误签名、限制、回滚/重启和并发重复。它是**单元级验证**，不能证明 HTTP 认证、请求头暴露、RPC 或发布就绪。协调者已在阻断网络与子进程调用的离线 harness 中成功运行此验证器。

## 部署必须另行授权

按完整指南检查版本/登录，创建全新隔离项目、API key authorizer 与用户，配置暴露请求头，在 `VIAT_SQLITE_ROOTS` 内建立单节点专属文件，然后初始化、发布、断言。推送前替换资源中的允许根目录占位路径。公开假密钥不能用于面向不可信流量的路由；真实密钥另行安全配置，只有资源已创建后才能用 `$secret` 保留它。

在完成指南前置步骤后，从 `project/` 执行：

```sh
viat push --only resources,scripts,endpoints
viat script run setup --args '{"confirm":"webhook-ingestion-isolated-db"}'
```

不要无范围 push：省略的元数据可能裁剪手工创建的 authorizer。端点使用 `target.ref`，不要改成调度使用的字段。平台会话与端点 API key 是不同凭据。在线命令必须单独授权；默认本地验证不访问网络或供应商。

## 安全、恢复与清理

300 秒时间窗只补充、不替代持久事件唯一键。同 ID 同字节返回 duplicate，不同字节返回 conflict。锁超时应使用原事件重试；供应商重试期内不能删除去重记录，更不能声称 SQL 与外部副作用 exactly-once。完整错误码、限制见指南。

仅取消发布/删除记录的端点 UUID，按 API key **行 UUID** 撤销密钥，仅清理新项目内本例实际拥有的用户、authorizer、脚本、资源。资源删除不删除 SQLite 文件；操作员需在停流、保留证据后，仅移除精确的新文件及 sidecar。1.1.0 不支持项目 DELETE。目前仅协调者离线单元验证通过；真实 HTTP/broker 验收、服务、部署、供应商调用与清理仍未验证。
