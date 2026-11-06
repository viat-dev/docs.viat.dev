---
title: '脚本指令'
description: '注释指令的精确拼写、默认值、校验与语言范围。'
doc_id: script.annotations
verified_release: '1.1.0'
channel: stable
---

# 脚本指令

指令必须独占一行注释，不是 `main` 上的属性。`python`、`shell`、`graphql`、`viat_gql`、`llm` 和 `binary` 的 YAML 清单使用 `#`；`sql` 使用 `--`；`typescript`、`rust` 使用 `//`。错误的注释符、值后追加解释或不合法的值可能让指令被忽略。解析器扫描源代码各行；建议集中写在开头，便于审核。

| 注释符后的精确内容 | 类型、默认值和校验 | 适用范围 |
| --- | --- | --- |
| `@resource db` | 可重复的资源引用，默认无。每段为 `[A-Za-z_][A-Za-z0-9_-]{0,63}`，用 `/` 连接。相同引用去重。 | 九种语言均支持。SQL、GraphQL、viat_gql、llm 必须恰好声明一个正确类型的资源。 |
| `uses: common, shared/util (live)` | 逗号分隔脚本引用；每项可追加字面标记 `(live)`。默认无。重复时 live 优先。 | 只有 Python、TypeScript 在运行时导入。Binary 拒绝 uses。 |
| `timeout: 120` | 首个合法的 1–6 位正整数，单位秒，不带单位后缀。缺失、零或不合法时回退，不代表无限制。仍受部署上限约束。 | 所有语言均可解析；工作流步骤使用工作流预算。 |
| `build-timeout: 300` | 首个合法的 1–6 位正整数秒数。默认部署依赖构建超时，通常 300 秒；部署最大值通常 3600 秒。 | Python/TypeScript 依赖环境构建，不是 Rust 编译超时。 |
| `requirements: package==1.2.3` | 行内逗号分隔，或空 `requirements:` 后连续的注释块。默认无额外包。 | Python 的 pip/uv 规格、TypeScript 的 npm 规格。 |
| `stream: true` | 不区分大小写的 `true` 开启；缺失、`false`、错误值均关闭。 | Python/TypeScript 的流通道声明，不会把普通返回值自动变成流。 |
| `max_concurrent: 2` | 首个合法整数 `1..99999`；缺失、零或错误值表示没有目标队列限制。 | 所有语言，只有符合条件的后台执行生效。 |
| `concurrency_key: report-builds` | 单段 `[A-Za-z_][A-Za-z0-9_-]{0,63}`；缺失使用资产身份。没有 `max_concurrent` 时无效。 | 所有语言；同项目脚本和工作流可共享后台并发预算。 |
| `@input id:int` 或 `@input limit:int=20` | Schema 注解；默认值以**字符串**保存。见下文。 | 仅 SQL（`--`）和 shell（`#`）。 |
| `deps: chrono = "=0.4.42"` | 每行一个 Cargo 依赖条目，默认无额外条目。 | 仅 Rust（`//`），与 `requirements:` 不同。 |

资源先在脚本所在文件夹查找，再查项目根，最后仅在全项目同名资源唯一时按裸名命中。文件夹引用不是文件系统路径。支持标识符绑定的语言仍需合法的导入名。包含 `-` 或 `/` 的资源名，Python 使用 `getattr(ctx.resources, "folder/name")`，因为资源 namespace 不支持下标；TypeScript 可用下标。

## requirements 块的边界

```python
# requirements:
# httpx==0.28.1
# pydantic==2.12.3
# @resource crm
from viat import ctx

def main():
    return {"ready": True}
```

空行或非注释行终止块。其他已识别指令也终止块，即使该指令的值不合法，也不会被当作包规格。行内列表按逗号切分，因此带逗号的 pip 约束应使用块形式。`package @ git+https://…` 这样的含空格规格不会被拆开。安装可访问仓库并执行构建脚本，应固定版本并审核来源。[依赖](dependencies.md)说明导入快照和环境构建。

## `@input` 类型

SQL 和 shell 将 `int/integer/bigint/smallint` 映射为 integer；`text/string/varchar/char` 为 string；`bool/boolean` 为 boolean；`numeric/decimal/float/double/real` 为 number；`json/jsonb` 为 object。未知类型回退为 string。名称匹配 `[A-Za-z_][A-Za-z0-9_]*`。没有 `=DEFAULT` 的注解会在提取 Schema 中成为必填。SQL 只处理实际出现的占位符；shell 只读取第一条实际命令之前的注解，允许空行和 shebang。

`=20` 得到 Schema 默认值 `"20"`，而非数值 `20`；它不是通用的运行时默认值注入。除非已验证端点的绑定和默认值配置，否则显式传入参数。Shell 允许省略时，应自行实现运行时回退。Schema 提取尽力而为，必须检查警告，参见[测试与 Schema](testing.md)。

## 准入与超时的易错点

不要写 `# max_concurrent: 2 # optional`，严格正则不接受尾注释。无效队列声明可能让执行立即开始而不是排队；发布会给出警告。只有 key 不构成限制。同步请求、直接 Test 和调度不会因为加了头就进入持久队列。[运行时](runtime.md)区分超时、通道与持久队列。
