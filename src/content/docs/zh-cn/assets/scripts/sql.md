---
title: 'SQL 脚本'
description: '数据库方言、带类型命名参数与 rows/affected 输出。'
doc_id: script.sql
verified_release: '1.1.0'
channel: stable
---

# SQL 脚本

语言值 `sql`，恰好声明一个 `postgresql`、`mysql`、`sqlserver` 或 `sqlite` 资源。方言由资源决定，不存在独立 mysql 脚本语言。平台用数据库客户端直接执行，没有 Python/Bun 或 `ctx`。账号需项目编辑/运行权限，数据库资源账号也必须具备执行相应 SQL 的权限。参数绑定不等于授权或只读限制。

## 完整最小脚本

已有隔离 PostgreSQL 资源 `db` 时，保存 `scripts/sql_echo.sql`：

```sql
-- @resource db
-- @input value:int
SELECT :value AS value;
```

```bash
viat script create --name sql_echo --language sql --file scripts/sql_echo.sql
viat script run sql_echo --args '{"value":7}'
viat script update sql_echo --file scripts/sql_echo.sql
```

预期正文 `{"rows":[{"value":7}],"affected":1}`。该只读例子不建表。资源创建语法为 `viat resource create --file resources/db.yaml`，不是 `--config`；资源参考定义其凭证和配置形状。不要将真实凭证放入源码或日志。公共绑定与发布见[测试](testing.md)。

## 参数与结果类型

所有方言均写 `:name`。绑定器转换为 PostgreSQL `$N`、MySQL `?`、SQL Server `@PN`、SQLite `?N` 并分开发送值，不要拼接用户数据。字符串、dollar quote 和 `::cast` 不会被运行时当参数。静态提取更简单，可能误读特殊 SQL，需检查警告。`-- @input name:type[=default]` 声明类型，未注解占位符默认为必填 string 并警告。默认值仍是**字符串**，不承诺为缺失参数填值。所有[类型名称](annotations.md)见指令页。

各方言返回 `{rows,affected}`。Numeric/decimal 通常为字符串以保留精度。PostgreSQL UUID/时间为字符串、bytea 为 base64、interval 为 `{months,days,microseconds}`、数组逐项转换；不支持的列可能为 null 并警告，可 cast text 自行决定表达。MySQL TINYINT(1) 为布尔值。SQL Server bit 为布尔值、uniqueidentifier 字符串、binary 为 base64；不支持的 spatial/sql_variant 可能直接失败而不是 null。SQLite 存储类型灵活，必要时显式 cast。SQL Server 使用 SQL 认证，不支持 Windows/AD。

## 语句、事务与失败

有参数的 PostgreSQL 脚本只能是一条 prepared statement。**无参数** PostgreSQL 脚本可回退 simple-query 执行多条，放入同一事务，失败全部回滚。文本协议结果并非所有类型都能解码（如 interval），因此有返回值的查询优先单条。其他引擎和 broker query helper 每次只执行一条，不能套用 PostgreSQL 特例。持久 DDL 应使用迁移工具，不应作为端点反复执行。

`-- timeout: N` 申请执行预算，仍受部署上限限制。数据库/网络错误和超时导致失败。没有 `ViatError`、tasks 或逐行流式输出。取消不保证撤销已发送写入，不要盲目重试写操作；工作流按运行时错误分类，不按任意 SQL 文本重试。多个业务操作需原子性时，使用通用语言的 broker 事务 helper。

在隔离资源验证结果和日志警告，先删除一次性端点再删 `sql_echo`。纯 SELECT 示例无需数据库清理。保存成功不能证明数据库可达。
