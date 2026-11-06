---
title: '依赖与快照'
description: '包依赖、uses 导入和发布依赖的实际行为。'
doc_id: script.dependencies
verified_release: '1.1.0'
channel: stable
---

# 依赖与快照

需要区分资源（`@resource`）、安装包（`requirements:` 或 Rust `deps:`）和作为模块导入的项目脚本（`uses:`）。资源不是模块，声明包也不会授予资源访问权。

## Python 与 TypeScript 模块

创建名为 `common` 的 Python 脚本资产，源码如下，不需要 `main`：

```python
def greet(name: str):
    return {"hello": name}
```

调用方资产 `hello` 的完整源码：

```python
# uses: common
from common import greet

def main(name: str = "world"):
    return greet(name)
```

输入 `{"name":"Ada"}` 返回 `{"hello":"Ada"}`。TypeScript 使用导出模块和相对导入：

```typescript
// Source of asset common
export function greet(name: string) { return { hello: name }; }
```

```typescript
// Source of asset hello
// uses: common
import { greet } from "./common";
export async function main(args: { name: string }): Promise<{ hello: string }> {
  return greet(args.name);
}
```

`uses:` 中填资产引用，不加 `.py`/`.ts`。解析顺序为当前文件夹、项目根、全项目唯一裸名。解析器递归遍历依赖图；缺失模块、语言不兼容、循环和歧义会报错，不会随意挑选。运行时以导入裸名建立同级文件，避免不同依赖路径需要同一个导入名。依赖声明的资源以依赖自身的文件夹为解析基准。

## 发布究竟冻结什么

对**脚本端点**，当**整张图中没有任何 `(live)` 引用**时，普通 `uses:` 依赖图随发布源码一起冻结，可使用预热池。编辑模块不会改变该端点，必须重新发布；回滚也恢复被冻结的模块图。旧文档中“所有模块永远实时读取”的概括不适用于此处。

```python
# uses: common, shared/rules (live)
```

任一显式 `(live)` 会让整张依赖图每次执行都从当前项目脚本解析，并强制使用新的单次进程。直接草稿、测试和调度执行没有发布依赖图，因此实时解析。没有冻结依赖元数据的旧快照也实时解析。

**1.1.0 的工作流步骤例外：**工作流发布冻结步骤脚本主体及嵌套工作流定义，但每次执行前仍从实时脚本填充步骤的 `uses:` 依赖，嵌套工作流内也一样。不要依靠工作流回滚恢复这些模块。因此主体步骤源码虽然冻结，工作流仍可能因共享模块编辑而在不发布时改变行为。

## 包与环境

Python 执行节点需要 `uv` 和可用 Python 解释器；TypeScript 需要 Bun。Requirements 安装到缓存的脚本环境。发布与显式构建会准备环境，但缺包、包仓库不可达、缺少原生构建工具或安装失败仍会阻止运行。`build-timeout:` 限制准备，`timeout:` 限制执行，两者不同。执行时碰到未构建环境，仍使用部署默认安装期限，不会获得任意长的脚本专属构建窗口。

```bash
viat script env hello --json
viat script env hello --probe --json
viat script build hello --wait
```

第一条查询记录的状态；`--probe` 查询缓存。构建会改变部署状态，可能下载包。Python/TypeScript 的依赖构建失败可能表现为发布警告；确认警告不等于运行时已就绪。切换流量前检查环境并安全地执行草稿。

Rust 使用 Cargo 和可选项目 crate，不使用 `uses:`。固定版本或保留锁文件，构建缓存不代表每次请求都会检查新的兼容依赖。[Rust](rust.md)说明构建与 Schema 探测。Binary 内容是构建产物清单，不是可安装依赖的源码环境。

## 验证与清理

在隔离项目发布 `hello`，只修改 `common`，比较已发布调用与 `viat script run hello --args '{"name":"Ada"}'`；重新发布前，二者刻意不同。再单独验证 `(live)`。本文没有执行在线验证。先删除测试端点，再删除脚本；删除共享依赖会破坏草稿、实时和旧快照调用方。离线导入不能证明发布或回滚语义，参见[测试](testing.md)。
