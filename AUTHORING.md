# 行文风格指南 / Authoring style guide

本仓库面向读者的是**帮助文档**,不是验收报告。覆盖面靠契约与测试保证,
可读性靠本指南保证。每个页面双语成对,遵循同一骨架。

This handbook is written for readers, not for auditors. Coverage is enforced
by contracts and tests; readability is enforced by this guide.

## 语音与结构 / Voice and structure

1. **任务先行。** 标题回答"我要完成什么",第一段用 1–3 句说明做完这个页面
   读者会得到什么,再列前提。不要以体系结构开场。
2. **短句,主动语态。** 一句话一个动作。连续限定从句拆成列表。每次想写
   "不是…也不是…"时,改为:先说它是什么,再用一个提示框说边界。
3. **步骤可复制。** 命令逐条给出,紧跟**预期输出**。读者粘贴后看到的与文档
   不同,就能立刻定位。
4. **警告入框,不混正文。** 用 GFM 提示块 `> [!NOTE]` / `> [!WARNING]` /
   `> [!TIP]`。正文中不夹带"注意""请勿"长句。
5. **骨架**:前提 → 步骤(带图或标签页)→ 验证 → 排错表 → 清理。
   参考页可省略步骤,但字段表、默认值、失败含义必须完整。
6. **核验依据收尾一行**,保留契约源码指针,不展开验收叙述:
   `契约源码 <sha>:<文件列表>。` 例外与未验证项放提示框,不单独成节。
   该节(`## 核验依据` / `## Verification basis`)是维护证据:**网站与离线书
   渲染时会自动剔除**,只在每页"原始 Markdown"中保留,所以不要把读者需要的
   信息写进这一节,也不要链接到它的锚点。

## 图文对照 / Screenshots next to prose

- 截图放在它描述的操作**之后**,图前一句话点出"看哪里"(控件名、页面位置)。
- 文件放 `public/screenshots/<locale>/<name>.png`;双语页面各自引用本语言
  截图:`![登录页](/screenshots/zh-cn/login.png)`。
- 截图只能来自本地测试实例(`npm run dev:capture` 重新生成),数据必须是
  合成演示数据。**绝不**出现:真实凭据、真实 token、真实客户名、本机路径。
- 概念图(SVG)放 `public/diagrams/`,同样以 `/diagrams/x.svg` 引用;网站与
  离线书都会随构建复制,校验会确认文件存在。

## 多实现方式标签页 / Implementation tabs

同一任务存在多种实现(控制台 / CLI / MCP / 环境变量)时,用标签页并列,
而不是分节或按页拆分。语法是纯 Markdown(前后必须空行):

```markdown
:::tabs id=activate

::tab 控制台

打开 `/ui/` …(步骤与截图)

::tab CLI

```sh
viat license activate - < code.txt
```

:::
```

- `id` 可选;同一 `id` 的标签组在整站范围内共享访客的选择(如访客选了
  CLI,下一篇的同类组默认停在 CLI)。`id` 用英文短横线命名。
- 标签顺序:控制台 → CLI → MCP/其他。标题用读者视角的词,不写内部术语。
- 标签页内部是完整可执行的路径:每个标签自带前提或说明,不依赖另一个
  标签的内容。
- 离线 mdBook 导出会把标签转换为**加粗小节**,LLM/原始 Markdown 保留源码
  语法——两处都必须仍可读,所以不要在标签里塞超长内容,超过约一屏应拆节。

## 提示块 / Alerts

```markdown
> [!NOTE]
> 说明行为边界或常见误解。

> [!WARNING]
> 不可逆操作或安全相关。
```

网站渲染为带色提示框;离线书导出为 `**Note:**` 加粗引言行。

## 语言与协议标识 / Language and wire identifiers

- 正文语言随 locale;字段名、枚举值、CLI 旗标、错误码一律保持字面值,
  不翻译、不复数化。
- zh-cn 面向中文工程师:技术名词首次出现可附英文,之后直接用中文;
  不逐句直译英文页——两页骨架一致、事实一致,行文各自自然。

## 每页必含 / Every page keeps

- frontmatter:`title`、`description`、`doc_id`、`verified_release`、
  `channel`,双语言段一致;`contract_ids` 按需。
- 前提(权限/版本/外部依赖)、失败含义(错误码 → 原因 → 处理)、
  有副作用页面的清理步骤。
- 示例代码与 `examples/` 事实文件用 `fixture=` 对齐,双语一致。
