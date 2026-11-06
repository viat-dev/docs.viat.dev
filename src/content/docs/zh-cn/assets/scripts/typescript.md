---
title: 'TypeScript 脚本'
description: 'Bun 入口、对象参数、异步辅助 API 与 Schema 限制。'
doc_id: script.typescript
verified_release: '1.1.0'
channel: stable
---

# TypeScript 脚本

语言值为 `typescript`，执行节点需要 **Bun**，只有 Node.js 不够。平台注入 `"viat"` 模块。`// requirements:` 声明 npm 包；`// uses:` 导入项目脚本，两者不同。

## 完整最小脚本

保存 `scripts/hello_ts.ts`：

```typescript
import { ctx } from "viat";
export async function main(args: { name: string }): Promise<{ hello: string }> {
  ctx.logger.info("greet", { who: args.name });
  return { hello: args.name };
}
```

```bash
viat script create --name hello_ts --language typescript --file scripts/hello_ts.ts
viat script run hello_ts --args '{"name":"Ada"}'
viat script update hello_ts --file scripts/hello_ts.ts
```

预期正文 `{"hello":"Ada"}`，Schema 将 name 标记为必填 string。需要认证后的项目执行/编辑权限；无需资源或模型提供商。公开时创建端点并按[测试](testing.md)发布其 ID；保存和更新不会自动发布。

## 函数形状与 Schema

导出同步或异步 `function main(args: {...})`，首参是**一个对象**，不是每个 HTTP 输入对应一个函数参数。运行时以 `(args, ctx)` 调用并等待结果。也可回退到默认导出，但静态提取寻找 main 函数声明，优先具名导出，保持运行与 Schema 一致。

使用内联对象参数和显式返回注解。`name?: string` 允许省略，`name: string | null` 允许 null，两者不同。`args.name ?? "world"` 是运行时代码，不保证提取出默认值。识别基本类型、对象字面类型、数组、Record 和部分联合；命名、导入、复杂类型可退化为开放 `{}`。这是语法提取，不是 `tsc` 类型解析。Bigint 注解可映射 integer Schema，但 BigInt 值并不是普通可 JSON 序列化的返回值。

## 异步 API 与响应形状

```typescript
// @resource api
import { ctx } from "viat";
export async function main() {
  return await ctx.resources.api.get("/health");
}
```

第二例需要已配置并获准使用的 `http_api` 资源 `api`，指向隔离服务。返回解码后的上游正文，会发出真实网络请求，需明确同意再执行。资源 helper、authz、缓存清除和 tasks 返回 Promise，必须 await，未等待的副作用不能视为可靠完成。日志和 `ctx.progress(50, "halfway")` 是同步上报。

从 `"viat"` 导入 `ViatError`、`ViatResponse`、`ViatStream`。构造器用选项对象，不同于 Python 的位置参数：`new ViatError({status:400,code:"invalid_input",message:"..."})`；`new ViatResponse({body:{ok:true},status:201})`。流使用 `new ViatStream({generator: asyncIterable})`，拒绝同步生成器。添加 `// stream: true` 选择流通道。[运行时](runtime.md)包含完整流示例、中途错误和取消语义；[上下文](context.md)列出字段。

## 环境与验证

Worker 模块可跨请求保留，不要用全局变量保留上一调用者或参数。`// requirements:` 经 Bun 安装；缺 Bun、包/构建失败和环境未准备不同于业务错误。检查 `viat script env hello_ts --json`，按需构建。[测试](testing.md)提供 Bun 离线断言与清理；草稿执行使用真实 helper。此语言支持 `ctx.tasks`，但不是所有九种语言都支持。返回值必须可 JSON 序列化，类型注解不能让类实例、循环对象或 BigInt 自动变安全。
