---
title: 发布第一个端点
description: 从已有部署和平台登录开始，完整完成 Python 脚本、公开端点、发布、HTTP 调用、日志与清理。
doc_id: getting-started.first-endpoint
verified_release: '1.1.0'
channel: stable
---

# 发布第一个端点

本教程创建独立 `hello-lab` 项目，上传一个 Python 函数，发布 `POST /hello`，无凭据调用它，并读取执行日志。使用**真实 CLI 1.1.0 语法**和无害问候示例，不需要外部资源、付费提供商、生产数据库或生产执行。

端点有意使用**匿名访问**，不要放入私有数据或真实业务操作。只在获准修改的部署上操作，最好使用仅回环暴露的 [Compose 安装](../installation/docker-compose.md)。

## 前提

- 已有运行中的 **server 1.1.0** 实例，工作站有匹配的 **CLI 1.1.0**。CLI 不会安装或启动服务端。
- 实例基础 URL、平台邮箱和密码。实例必须已激活；未激活时由平台 Owner/Admin 按[激活](../instance/activation.md)操作。
- **服务端**支持 `uv`/Python，官方镜像已提供。工作站完成本教程只需 CLI、Bash、文本编辑器和 `curl`。
- 可以创建独立项目；创建者成为项目 Owner。若使用已有项目，需项目 Owner/Admin 为你发布，项目 Developer 可编辑但不能发布。
- 未使用的项目 slug `hello-lab` 和私有本地目录 `viat-first-endpoint`。若已存在，请另选 slug/目录，并一致替换所有出现位置，不要覆盖已有资产。

shell 片段使用 **Bash**。只应在自己获准使用的非生产实例上执行。文末记录的自动验收使用隔离测试宿主，不是客户或生产部署。

## 1. 检查部署并登录

本地 Compose 安装使用：

```bash
mkdir viat-first-endpoint
cd viat-first-endpoint
umask 077
export VIAT_SERVER=http://127.0.0.1:8080
curl --fail --silent --show-error "$VIAT_SERVER/healthz"
viat --version
read -r -p 'Platform email: ' VIAT_EMAIL
read -r -s -p 'Platform password: ' VIAT_PASSWORD; printf '\n'
viat auth login --server "$VIAT_SERVER" --email "$VIAT_EMAIL" --password "$VIAT_PASSWORD"
unset VIAT_PASSWORD
viat auth whoami
viat version
```

远程实例请在运行前把 `VIAT_SERVER` 改为真实基础 URL。有反向代理挂载前缀时包含它，但不要加 `/ui/` 或 `/p/hello-lab`。本地设置的 `/healthz` 返回 `{"status":"ok"}`。登录打印 `logged in as <your-email>`，`whoami` 打印同一邮箱。版本输出应包含 `viat 1.1.0 (cli)`，并在可用时包含服务端 `1.1.0` 行。

密码登录必须同时提供 `--email` 和 `--password`，CLI 不会对省略值弹出提示。Bash 提示避免把密码字面值写入历史，但生成的密码参数短暂可被本机进程检查看到，应使用可信工作站。已登记 MFA 时按 CLI 提示输入验证；若要求登记，先在控制台完成一次再重试。认证失败就停止，不要继续用另一个保存会话操作。

`.viat/config.yaml` 含会话凭据，需保密并排除版本控制。配置查找与 SSO 见[平台用户](../instance/platform-users.md)。

## 2. 创建并选择项目

```sh
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project member ls --json
```

预期包含 `created hello-lab` 和 `selected hello-lab`，你的成员行是 `role: "owner"`。这是远程创建，不是本地骨架初始化。项目已有默认端点树和内置 `anonymous` 认证器，后面会明确选用。

若提示 `slug already taken`，除非确认它就是自己的可丢弃项目，否则不要继续使用该名字。[创建项目并协作](../projects/create-and-collaborate.md)介绍 slug 和成员角色。

## 3. 编写并上传脚本

创建名为 `hello.py` 的 UTF-8 文件，完整内容为：

```python fixture=hello-endpoint/hello.py
def main(name: str = "world") -> dict:
    print("hello endpoint invoked")
    return {"message": f"Hello, {name}!"}
```

这是运行时执行的 Python `main(...)` 函数语法，不接受虚构的 `ctx` 位置参数。本函数不需要资源声明或依赖块。`name` 的类型注解和默认值描述可选字符串输入；字典返回值会成为 JSON。

上传并查看服务端草稿：

```sh
viat script create --name hello --language python --file hello.py
viat script show hello --json
```

预期创建输出：`created hello (v1)`。JSON 视图包含 `name`、`language`、源码、版本和推断结构。`script create` 使用 `--name`、`--language`、`--file`；`hello.py` 不是隐式位置参数。

直接运行**草稿**：

```sh
viat script run hello --args '{"name":"Ada"}'
```

预期 JSON 输出：

```json
{"message":"Hello, Ada!"}
```

空白和美化格式可能不同。本次运行执行服务端草稿，但没有创建对外 HTTP 路由。一般草稿运行也可能有真实副作用；本函数只返回问候并打印一条日志。

JSON 必须经过 shell 解析后仍有效。名字内含双引号时，用 shell 单引号保留 JSON 转义：

```sh
viat script run hello --args '{"name":"Ada \"Lovelace\""}'
```

预期 JSON 字符串值为 `Hello, Ada "Lovelace"!`（JSON 序列化后的引号呈现为 `\"`）。不要把 `{'name': 'Ada'}` 这样的 Python 字典语法作为 JSON 参数。

## 4. 绑定明确公开的端点

```sh
viat endpoint create --segment hello --method POST --script hello --authorizers anonymous
```

预期输出两行：

```text
created POST /hello
id: <server-generated-endpoint-UUID>
```

尖括号文字表示动态值，不是要提交的 UUID。将 `id:` 后的真实值复制到以下提示：

```bash
read -r -p 'Endpoint UUID from create output: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
```

检查方法 `POST`、路径 `/hello`、脚本 `hello`、允许认证器 `anonymous`。对于新项目默认树中的根级端点，无需 parent/tree 参数。本例不添加授权门禁。任何能访问实例的人都能调用匿名路由。

完整调用 URL 是 **`$VIAT_SERVER/p/hello-lab/hello`**，不是 `/projects/hello-lab/...` 管理 URL，也不是 `/ui/...`。

## 5. 发布此端点

```sh
viat endpoint publish "$ENDPOINT_ID"
```

全新端点预期输出 `published POST /hello as v1`，随后可能有构建结果。本流程有意只发布所选端点，而不是共享项目所有无关草稿。`viat publish plan` 仅只读审查，不执行发布。

警告或已启用回归用例阻止发布时，应阅读并修复，不要自动添加 `--acknowledge-warnings` 或 `--acknowledge-test-failures`。还需看依赖构建结果：默认 `VIAT_PUBLISH_BUILD_BLOCK=0` 允许构建失败仍发布。默认同步构建，运维也可启用后台构建，此时应等待环境准备好再期待首次调用成功。`viat script env hello --json` 查看记录的环境状态，`viat script build hello --wait` 可显式准备环境。

对外分发读的是**快照**，不是实时端点/脚本行。只改 `hello.py` 不会改变服务端；`script update` 修改草稿，再次发布才改变公开路由。普通 `uses:` 导入在发布时冻结，显式 `(live)` 导入是例外，见[核心概念](../overview/concepts.md)。

## 6. 调用已发布 API

由于明确使用 `anonymous`，不需要平台令牌或 API key：

```sh
curl --silent --show-error --include \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{"name":"Ada"}'
```

预期 HTTP 状态：**`200`**。预期 JSON 响应体：

```json
{"message":"Hello, Ada!"}
```

此端点普通请求体模式要求 JSON **对象**，而不是 JSON 字符串、数组或 Python 字面量。没有显式覆盖规则时，对象字段透传为函数参数。本函数无必填输入，下例使用 Python 默认值：

```sh
curl --silent --show-error \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{}'
```

预期响应为 `{"message":"Hello, world!"}`。也可使用 `viat call --method POST /hello --body '{"name":"Ada"}'` 提交 JSON 对象；这里优先展示 `curl`，因为它不依赖已配置项目令牌，能明确演示未认证应用调用者。

## 7. 找到执行与捕获输出

```sh
viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json
```

预期响应对象包含 `items` 和 `next_before`。刚才公开调用应显示 `method: "POST"`、成功状态、耗时和 `request_id`。若日志尚未入库，稍等后重查；不要把前面的草稿测试与这里按端点过滤的请求混为一谈。

复制一条记录的 `request_id`：

```bash
read -r -p 'Request UUID from logs query: ' REQUEST_ID
viat logs show "$REQUEST_ID" --json
```

检查执行详情和捕获行 `hello endpoint invoked`。时间戳、UUID、耗时、分页游标都是动态值，本教程不提供固定预期 ID。需要交互实时流时，`viat logs tail` 订阅到 `Ctrl-C` 为止；先订阅再调用即可观察实时事件。

HTTP 输出成功并与服务端日志对应，才能共同验证路由。只有日志记录不够：被拒绝请求也会记录，目标可能根本没启动。日志受后端和保留设置约束。

## 排错

| 失败 | 检查 |
| --- | --- |
| `not logged in` / 未配置服务端 | 在此私有目录重新登录，检查 `VIAT_CONFIG_DIR` 或祖先配置 |
| `403 license_required` | 平台 Admin/Owner 需激活，HTTP 健康不等于已激活 |
| 无法选择项目 | 核对实例、slug、平台邮箱、成员关系 |
| 可编辑但发布返回 `403` | 需要项目 Owner/Admin，不只是 Developer 或平台 Admin |
| 调用 `404` | 检查 `/p/<slug>/...` URL 和活动发布，草稿不会对外服务 |
| 方法拒绝 | 使用 `POST`，不是浏览器地址栏的 `GET` |
| `400` 附请求体/输入详情 | 发送有效 JSON 对象，`name` 为字符串，检查转义和 `Content-Type` |
| Python 进程/依赖错误 | 检查服务端 `uv`、环境构建状态、日志与容器权限 |
| 调用仍返回旧代码 | 用 `viat script update hello --file hello.py` 上传变化，再发布 |
| 所谓公开路由返回 `401`/`403` | 检查已发布认证器和门禁，不只是草稿 |
| 没有对应日志 | 核对当前项目、端点 UUID、保留/后端延迟，以及请求是否到达此实例 |

本例没有上游秘密或外部副作用，不能将它的安全性套用于真实数据库、邮件、消息或模型资源脚本。

## 8. 清理教程

先取消发布，再删除端点和脚本：

```sh
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat script delete hello
viat endpoint list --json
viat script list --json
```

示例路由应不再成功响应；列表中可能仍有内置认证端点。命令不会删除项目或历史执行记录。不要编造 `viat project delete`，本 CLI 没有该命令。临时协作者关系需另行移除。

结束后，`viat auth logout` 清理解析到的**本地** CLI 会话，本发行不会借此撤销被盗服务端会话，应使用控制台会话控件撤销。确认不再需要后再移除本地教程文件/目录；不要将 `.viat/` 放进提交或共享压缩包。

## 已执行验收与剩余边界

共享的 `hello.py` 已通过本地函数断言和产品侧显式启用的 `handbook_first_endpoint_real_cli` 集成测试。测试构建 CLI，使用隔离 PostgreSQL 测试库及回环 API，实际完成登录、创建与选择项目、上传及草稿运行脚本、创建与发布端点、匿名 HTTP 和 CLI 调用、查日志、取消发布/删除以及本地退出。它直接读取本手册的源码文件，而不是复制一份问候代码。

测试宿主使用明确激活的**测试许可证**和合成账号。它验证端点链路，不覆盖安装、获取或激活真实客户激活码、MFA/SSO、所有失败分支或外部提供商；这些仍是独立前提和验收任务。

## 核验依据

契约源码 `03751a67`：`crates/viat-cli/src/main.rs` 的 Clap 定义；`commands/{auth,project,script,endpoint,logs}.rs` 的命令实现；`crates/viat-api/tests/it/script_schema.rs` 的 Python 签名和结构示例；`crates/viat-api/src/handlers/dispatch.rs` 的 JSON 请求体绑定；`handlers/snapshots.rs` 的快照发布。目标稳定 server/CLI 产物为 `1.1.0`（`fd340879`）。
