---
title: 核心概念与边界
description: 区分实例、项目、身份、资源、端点草稿、已发布快照和执行记录。
doc_id: overview.concepts
verified_release: '1.1.0'
channel: stable
---

# 核心概念与边界

读完本页,你可以在"该改哪个对象、谁有权改、外部调用方看到什么"这三个问题上
不再犹豫。不需要任何账号即可理解模型;想跟着验证命令操作,需要平台会话与
项目成员资格(编辑需 `developer` 及以上,发布需 `admin` 或 `owner`)。

![Viat 核心对象关系](/diagrams/concepts.zh-cn.svg)

## 实例、项目与端点树

| 对象 | 是什么 | 示例 |
| --- | --- | --- |
| 实例 | 一套服务端部署:平台账号、激活状态、配置、PostgreSQL 平台库 | `https://api.example.com` |
| 项目 | 实例内的资产与协作者命名空间,slug 唯一 | `hello-lab` |
| 端点树 | 项目的路由组织:目录节点分组,可调用叶节点带 HTTP 方法与目标 | `POST /hello` |
| 脚本 / 工作流 | 可执行资产;工作流编排执行目标,不是端点目录 | `hello`(Python) |
| 资源 | 可复用连接或平台能力:数据库、HTTP API、存储、邮件、密钥 | `demo-db` |
| 调用 URL | 外部调用方使用的完整地址 | `https://api.example.com/p/hello-lab/hello` |

注意三层易混点:

- 管理路由用 `/projects/<slug>`,对外调用用 `/p/<slug>`;两者不等价。
- 反向代理挂载前缀要算进实例基础 URL;CLI 登录的 server URL 不含 `/ui`
  或 `/p/<slug>`。
- 同一脚本可以绑定多个端点,分别使用不同方法和访问规则;路径片段不必等于
  脚本名。

## 三个身份平面,不是一张角色表

| 平面 | 代表谁 | 访问由什么决定 |
| --- | --- | --- |
| 平台用户 | 登录控制台、CLI 或原生应用的人 | 平台角色:`owner`、`admin`、`developer`、`operator` |
| 项目协作者 | 加入某个项目的平台用户 | 项目成员角色:`owner`、`admin`、`developer`、`operator` |
| 终端用户 / 机器调用者 | 消费已发布 API 的人或程序 | 项目认证器、终端用户角色与属性、授权模型 |

- 平台 `owner` **不会**自动成为每个项目的协作者;把账号加进项目才会。
- 改平台角色不改变项目成员角色;添加终端用户也不会给控制台权限。
- 命令对应关系:`viat user` 管平台人员,`viat project member` 管协作者,
  `viat p-user` / `viat role` / `viat authorizer` 管项目调用者身份。
  完整流程见[平台用户](../instance/platform-users.md)与
  [创建项目并协作](../projects/create-and-collaborate.md)。

## 资源与秘密

资源配置区分非秘密的 `plain` 字段和加密的 `secret` 字段;普通管理读取只会
返回脱敏摘要。有意提供秘密值的 `secret` / `config` 资源与提供商认证凭据是
不同契约。

> [!WARNING]
> 1.1.0 的部分旧式数据库、缓存、消息和 S3 资源投影仍向工作进程注入含凭据的
> 连接信息。脚本及其依赖树应视为能接触该凭据:优先使用代理 helper,切勿
> 返回或打印整个资源对象;各类型边界见[资源参考](../assets/resources/index.md)。

不要把保存业务表的 PostgreSQL 资源与 PostgreSQL **平台数据库**混为一谈;
`sqlite` 资源也只能访问允许的服务端文件,不能替代平台持久化。

## 草稿、发布与回滚

编辑端点、认证或输入契约,改变的是**草稿**;对外分发读取**当前已发布快照**。
发布捕获路由契约和目标定义;测试运行不等于发布。执行 `viat publish apply`
前,先看 `viat publish plan`。

依赖在发布时如何冻结,取决于目标类型:

| 目标 | 依赖处理 |
| --- | --- |
| 脚本端点(无 `(live)` 引用) | 发布时冻结普通 Python/TypeScript `uses:` 导入 |
| 工作流步骤脚本(1.1.0) | 主源码冻结,`uses:` 依赖(含嵌套步骤)每次运行前实时解析 |
| `# uses: shared/util (live)` | 每次运行读实时源码,使用新工作进程 |
| 草稿测试 / 直接调度 | 实时解析,不执行冻结快照 |
| 无冻结数据的旧快照 | 退回实时解析;升级后如需冻结依赖图应重新发布 |

因此不能笼统承诺"所有导入都是实时的"或"回滚会恢复依赖"。资源凭据与上游
配置始终是实时状态——轮换凭据不是部署端点代码。

> [!NOTE]
> 发布成功不保证运行环境已构建完成:默认同步构建,但
> `VIAT_PUBLISH_BUILD_BLOCK=0` 允许构建失败仍发布,`VIAT_PUBLISH_BUILD_ASYNC=1`
> 允许后台构建。判断发布健康前,检查 `viat script env <name> --json` 的构建
> 结果。

## 认证不等于授权

- **认证器**回答"调用者是谁"。端点向上继承时,最近一层明确声明的认证器列表
  会**替换**祖先列表,不是合并。
- **授权门禁**(`authz_gates`,元素为 `{type, action}`)回答"已识别的调用者能否
  调用路由"。门禁沿树**累积**,直到 `override_permissions` 停止继承。
- 内置 `anonymous` 认证器用于明确公开的路由;控制台登录令牌不能与终端用户
  令牌或 API key 互换。

## 执行与证据

执行记录含 `request_id`、状态、耗时等元数据;行日志是目标捕获的输出。被
拒绝的请求也可能生成执行记录而不启动工作进程。日志受后端与保留策略约束,
不能当永久备份。

完成[第一个端点](../getting-started/first-endpoint.md)的登录与项目选择后,
可以只读巡检:

```sh
viat project list
viat endpoint list --json
viat publish plan --json
viat logs query --limit 10 --json
```

预期依次得到:可访问项目、端点记录、待发布变更、含 `items` 与 `next_before`
的分页。新项目返回空列表是正常的;这些命令不会发布或运行任何脚本。

## 定位边界误用

| 现象 | 检查方向 |
| --- | --- |
| 平台 Admin 看不到项目 | 将账号加入项目;平台角色不绕过成员检查 |
| Developer 可编辑但不能发布 | 需项目 Owner/Admin,平台 Admin 不够 |
| 有效终端用户令牌收到 `403` | 检查已发布认证器列表与全部继承门禁 |
| 草稿响应变了,调用响应没变 | 发布;并核对实例、项目与活动快照 |
| 回滚没有恢复上游凭据 | 凭据是实时资源状态,不在快照里 |
| 配了 `sqlite`,服务仍要求 PostgreSQL | 资源库与平台持久化是两层概念 |

清理实验时,先取消发布路由,再删除端点及执行目标;移除项目成员不会删除项目
内容。具体步骤见[第一个端点](../getting-started/first-endpoint.md)。

## 核验依据

契约源码 `03751a67`:`crates/viat-core/src/types/{project,script,resource,snapshot}.rs`、`crates/viat-db/src/projects.rs`、`crates/viat-db/src/endpoints.rs`、`crates/viat-api/src/handlers/snapshots.rs`、`crates/viat-cli/src/main.rs`。
