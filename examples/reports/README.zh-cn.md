# SQL 报表与显式启用的 SMTP — Viat 1.1.0

[English](README.md) · [完整中文指南](../../src/content/docs/zh-cn/applications/reports.md)

完整可推送项目：SQL 聚合 → 确定性文本报表 → **可选** SMTP 提交。工作流/HTTP 输入与默认禁用的 UTC 调度都设置 `send:false`。报表持久化是真实写入；默认通知不发送邮件。SMTP 资源仅描述操作员另行批准的捕获中继，不启动服务。

## 本地单元验证

在本目录：

```sh
python3 -I validate.py
```

标准库验证器加载**实际部署**的 setup、builder、notifier，在临时 SQLite 上执行其 SQL，注入假 Viat/SMTP 对象；验证精确聚合/时间边界、默认不发送、输入/大小限制、不可变报表、持久 claim/去重、SMTP 未知结果以及假中继接受后确认写入失败。**不会发送邮件。** 不证明 HTTP、YAML 引擎、RPC、cron 或真实投递。协调者已在阻断网络与子进程调用的离线 harness 中成功运行此验证器。

`fixtures/input.json` 是固定合成日期窗口，`fixtures/expected.json` 是完整工作流结果。schema 与种子在 `project/scripts/setup.py`，`case.json` 固定服务端 1.1.0，无第三方 Python 依赖。

## 部署必须另行授权

按完整指南创建全新 `example-reports` 项目，检查版本/登录/权限，创建 authorizer/用户/API key，在 `VIAT_SQLITE_ROOTS` 内挂载单节点专属文件，配置路径、初始化、发布、断言。完成前置步骤后从 `project/` 执行：

```sh
viat push --only resources,scripts,workflows,schedules,endpoints
viat script run setup --args '{"confirm":"reports-isolated-db"}'
```

不能省略 `--only`：最小元数据不能裁剪另外创建的 authorizer。按类别镜像不能用于已有项目的部分 checkout。端点使用 `target.ref`，调度使用 `target.name`。push 不发布、不初始化。默认验证不得启用调度、执行 SMTP Test 或发送。

## 限制与恢复

UTC [start,end) 日期窗口为 1–31 天；两者为空时取执行时的前一 UTC 日。限制：10000 源行、65536 文本字节、整数分、CNY/USD 分币种汇总。首次生成按版本/日期键冻结内容；迟到数据纠正必须有意采用新报表标识。源时间戳必须统一为固定宽度 UTC 文本。

SMTP 前先提交持久发送 claim；accepted、sending、uncertain 都阻止自动重发。崩溃/超时可能需要人工核对中继。接受不等于入箱，SMTP 与 DB 不是原子事务。指南给出独立授权的捕获中继配置、精确到报表/attempt 的恢复条件和清理；保留证据，不能清空全部 claim 来重试。

仅清理记录的端点/密钥**行 UUID**、`report-daily` 和新项目内精确拥有的资产。删除资源不删除 SQLite 文件，更不能召回邮件。1.1.0 不支持项目 DELETE。目前仅协调者离线单元验证通过；真实 HTTP/broker/SMTP/调度验收、服务、部署、SMTP/联网与清理仍未验证。
