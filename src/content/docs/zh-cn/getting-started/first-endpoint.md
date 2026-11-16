---
title: 发布第一个端点
description: 从已有部署和平台登录开始，完整完成 Python 脚本、公开端点、发布、HTTP 调用、日志与清理。
doc_id: getting-started.first-endpoint
verified_release: '1.1.0'
channel: stable
---

# 发布第一个端点

本教程结束时,你会拥有一个匿名可调用的线上接口:

- 独立项目 `hello-lab`,内含 Python 脚本 `hello`;
- 已发布的 `POST /hello`,无需任何凭据即可调用;
- 一条可在控制台"运行记录"里看到的执行日志。

全程使用**真实 CLI 1.1.0 语法**,不需要外部资源、付费提供商或生产数据库。
下面的端点树截图就是完成后在控制台里看到的样子。

![端点树显示已发布的 POST /hello](/screenshots/zh-cn/endpoints.png)

端点有意使用**匿名访问**:任何能访问该实例的人都能调用它,不要放私有数据。
只在获准修改的部署上操作,推荐使用仅回环暴露的
[Compose 安装](../installation/docker-compose.md)。

## 前提

- 运行中的 **server 1.1.0** 实例和匹配的 **CLI 1.1.0**;CLI 不会安装或启动服务端。
- 实例基础 URL、平台邮箱和密码;实例已激活(未激活时由平台 Owner/Admin 按
  [激活](../instance/activation.md)处理)。
- 服务端支持 `uv`/Python(官方镜像已内置)。工作站只需要 CLI、Bash、文本
  编辑器和 `curl`。
- 可以创建项目(创建者成为项目 Owner)。若复用已有项目,发布操作需要项目
  Owner/Admin,Developer 只能编辑。
- 未使用的项目 slug `hello-lab` 和本地目录 `viat-first-endpoint`。若已存在,
  换一个名字并全文替换,不要覆盖已有资产。

shell 片段为 **Bash**。文末的自动验收使用隔离测试宿主,不是客户部署。

## 1. 检查部署并登录

本地 Compose 安装使用:

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

预期:`/healthz` 返回 `{"status":"ok"}`;`whoami` 打印你的邮箱;版本输出含
`viat 1.1.0 (cli)`,可用时还有服务端 `1.1.0` 一行。远程实例把 `VIAT_SERVER`
换成真实基础 URL——含反代挂载前缀,但不含 `/ui/` 或 `/p/hello-lab`。

> [!NOTE]
> 密码登录必须同时给 `--email` 和 `--password`,CLI 不会交互补问。`read -s`
> 避免密码进入 shell 历史,但参数对本机进程短暂可见,请用可信工作站。已登记
> MFA 时按 CLI 提示输入验证码。登录后的 `.viat/config.yaml` 含会话凭据,需
> 保密并排除版本控制;配置查找与 SSO 见[平台用户](../instance/platform-users.md)。

## 2. 创建并选择项目

```sh
viat project create hello-lab "Hello Lab"
viat project select hello-lab
viat project member ls --json
```

预期输出含 `created hello-lab`、`selected hello-lab`,你的成员行为
`role: "owner"`。这是远程创建,不是本地骨架初始化;新项目自带默认端点树和
内置 `anonymous` 认证器,第 4 步会明确选用它。

若提示 `slug already taken`,除非确认那是自己的可丢弃项目,否则换名重试。
slug 与成员角色详见[创建项目并协作](../projects/create-and-collaborate.md)。

## 3. 编写并上传脚本

创建 UTF-8 文件 `hello.py`,完整内容:

```python fixture=hello-endpoint/hello.py
def main(name: str = "world") -> dict:
    print("hello endpoint invoked")
    return {"message": f"Hello, {name}!"}
```

这是运行时执行的 `main(...)` 函数签名——不接受虚构的 `ctx` 位置参数,也不
需要资源声明或依赖块。`name` 的注解与默认值构成可选输入;字典返回值序列化为
JSON。上传并查看服务端草稿:

```sh
viat script create --name hello --language python --file hello.py
viat script show hello --json
```

预期 `created hello (v1)`;JSON 视图含名称、语言、源码、版本和推断出的输入
结构。注意 `script create` 用的是 `--name/--language/--file`,`hello.py` 不是
隐式位置参数。

先在服务端**试运行草稿**:

```sh
viat script run hello --args '{"name":"Ada"}'
```

预期输出:

```json
{"message":"Hello, Ada!"}
```

草稿运行也可能有真实副作用(本函数只打印一行日志)。参数必须是有效 JSON
对象;名字里带双引号时,外层用 shell 单引号保留 JSON 转义:

```sh
viat script run hello --args '{"name":"Ada \"Lovelace\""}'
```

预期字符串值为 `Hello, Ada "Lovelace"!"` 的 JSON 形式。不要把
`{'name': 'Ada'}` 这类 Python 字典语法当 JSON 传。

![脚本编辑器中的 hello](/screenshots/zh-cn/script-editor.png)

上图是同一脚本在控制台中的样子:编辑器、推断的输入 Schema 与运行记录共用
一个页面。

## 4. 绑定明确公开的端点

```sh
viat endpoint create --segment hello --method POST --script hello --authorizers anonymous
```

预期两行输出:

```text
created POST /hello
id: <server-generated-endpoint-UUID>
```

尖括号内是动态值。把真实的 `id:` 值复制进下面的提示:

```bash
read -r -p 'Endpoint UUID from create output: ' ENDPOINT_ID
viat endpoint show "$ENDPOINT_ID" --json
viat publish plan --json
```

检查方法 `POST`、路径 `/hello`、脚本 `hello`、认证器 `anonymous`。新项目
默认树的根级端点无需 parent/tree 参数;本例不加授权门禁。

完整调用 URL 是 **`$VIAT_SERVER/p/hello-lab/hello`**——不是
`/projects/hello-lab/...` 管理 URL,也不是 `/ui/...`。

## 5. 发布此端点

```sh
viat endpoint publish "$ENDPOINT_ID"
```

预期 `published POST /hello as v1`,随后是构建结果。本流程只发布所选端点,
不共享项目里的其他草稿;`viat publish plan` 是只读预览。

> [!WARNING]
> 警告或回归用例阻止发布时,阅读并修复原因,不要自动加
> `--acknowledge-warnings` 或 `--acknowledge-test-failures`。默认
> `VIAT_PUBLISH_BUILD_BLOCK=0` 允许构建失败仍发布;确认构建状态用
> `viat script env hello --json`,需要显式等待时用 `viat script build hello --wait`。

对外分发读的是**快照**:之后只改本地 `hello.py` 不影响服务端;`script update`
修改草稿,再次发布才更新公开路由。依赖冻结规则见[核心概念](../overview/concepts.md)。

## 6. 调用已发布 API

:::tabs id=first-call

::tab curl(匿名调用方)

```sh
curl --silent --show-error --include \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{"name":"Ada"}'
```

预期 HTTP 状态 **`200`**,响应体:

```json
{"message":"Hello, Ada!"}
```

`curl` 不依赖任何项目令牌,最直接地演示了"未认证的匿名调用方"。

::tab viat call(带项目令牌)

```sh
viat call --method POST /hello --body '{"name":"Ada"}'
```

预期同样的 JSON 正文。`viat call` 使用当前选择项目的令牌,适合调试;匿名
路由并不需要它。

:::

本端点要求 JSON **对象**请求体——不是字符串、数组或 Python 字面量。没有显式
覆盖规则时,对象字段透传为函数参数;空对象 `{}` 会落到 Python 默认值:

```sh
curl --silent --show-error \
  --request POST "$VIAT_SERVER/p/hello-lab/hello" \
  --header 'Content-Type: application/json' \
  --data '{}'
```

预期响应 `{"message":"Hello, world!"}`。

## 7. 找到执行与捕获输出

```sh
viat logs query --endpoint "$ENDPOINT_ID" --limit 10 --json
```

预期响应对象含 `items` 和 `next_before`;刚才的公开调用显示
`method: "POST"`、成功状态、耗时和 `request_id`。日志尚未入库时稍等重查;
别把第 3 步的草稿测试与按端点过滤的请求混为一谈。

```bash
read -r -p 'Request UUID from logs query: ' REQUEST_ID
viat logs show "$REQUEST_ID" --json
```

检查执行详情与捕获行 `hello endpoint invoked`。时间戳、UUID、耗时、分页游标
均为动态值。实时观察用 `viat logs tail`(先订阅再调用)。

![运行记录页](/screenshots/zh-cn/runs.png)

HTTP 输出成功且服务端日志对应,才能共同证明路由生效:只有日志记录不够——被
拒绝的请求也会记录。日志受后端与保留设置约束。

## 排错

| 失败 | 检查 |
| --- | --- |
| `not logged in` / 未配置服务端 | 在本目录重新登录;检查 `VIAT_CONFIG_DIR` 或祖先配置 |
| `403 license_required` | 平台 Admin/Owner 先激活;HTTP 健康不等于已激活 |
| 无法选择项目 | 核对实例、slug、平台邮箱、成员关系 |
| 可编辑但发布返回 `403` | 需项目 Owner/Admin,Developer 或平台 Admin 不够 |
| 调用 `404` | 检查 `/p/<slug>/...` URL 和活动发布;草稿不对外服务 |
| 方法拒绝 | 用 `POST`,浏览器地址栏是 `GET` |
| `400` 附请求体详情 | 发送有效 JSON 对象;`name` 为字符串;检查转义与 `Content-Type` |
| Python 进程/依赖错误 | 检查服务端 `uv`、构建状态、日志与容器权限 |
| 调用仍返回旧代码 | `viat script update hello --file hello.py` 后再发布 |
| "公开"路由返回 `401`/`403` | 检查已发布认证器与门禁,不只是草稿 |
| 没有对应日志 | 核对项目、端点 UUID、保留策略与请求是否到达本实例 |

## 8. 清理教程

先取消发布,再删除端点和脚本:

```sh
viat endpoint unpublish "$ENDPOINT_ID"
viat endpoint delete "$ENDPOINT_ID"
viat script delete hello
viat endpoint list --json
viat script list --json
```

示例路由不再响应;列表里内置认证端点仍在,属正常现象。命令不会删除项目或
历史执行记录;本 CLI 没有 `viat project delete`。最后 `viat auth logout`
清理解析到的**本地**会话(撤销服务端会话用控制台的会话管理);确认不再需要后
移除本地目录,不要把 `.viat/` 提交或打包。

## 核验依据

契约源码 `03751a67`:`crates/viat-cli/src/main.rs` 的 Clap 定义;
`commands/{auth,project,script,endpoint,logs}.rs`;`crates/viat-api/tests/it/script_schema.rs`;
`handlers/dispatch.rs` 的 JSON 请求体绑定;`handlers/snapshots.rs` 的快照发布。
目标稳定产物 `1.1.0`(`fd340879`)。

> [!NOTE]
> 本页的 `hello.py` 由产品侧 `handbook_first_endpoint_real_cli` 集成测试在
> 隔离 PostgreSQL 测试库上实际执行过(登录、创建、发布、匿名调用、清理)。
> 测试许可证与合成账号不覆盖安装、真实激活码获取、MFA/SSO 与外部提供商,
> 这些是独立前提。
