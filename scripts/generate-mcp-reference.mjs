import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { notes, permissions, fieldMeaning, omission, endpointJson } from '../content/mcp-notes.mjs';
import { escapeGeneratedHtml } from './lib/markdown.mjs';

const root = new URL('../', import.meta.url);
const contract = JSON.parse(await readFile(new URL('contracts/1.1.0/mcp-tools.json', root), 'utf8'));
const names = contract.tools.map(t => t.name);
if (contract.count !== 46 || names.length !== 46 || names.some(n => !notes[n]) || Object.keys(notes).some(n => !names.includes(n))) {
  throw new Error('The 46-tool inventory and hand-authored semantic notes must match exactly.');
}
const esc = x => String(x).replaceAll('|', '\\|').replaceAll('\n', ' ');
const json = x => '```json\n' + JSON.stringify(x, null, 2) + '\n```';
const word = (lang, en, zh) => lang === 'en' ? en : zh;
function localDefault(value, lang) {
  if (lang === 'en' || !value) return value;
  const translated = {
    'VIAT_PROJECT / current_project; else project_required': 'VIAT_PROJECT / current_project；否则 project_required',
    'required on create; ignored on update': '创建必填；更新忽略',
    'required on create; unchanged on update': '创建必填；更新不变',
    'create false; update unchanged': '创建 false；更新不变',
    'create 2; update unchanged': '创建 2；更新不变',
    'no request body': '不发送正文', 'no extra headers': '无额外请求头',
    'deployment timezone (UTC default)': '部署时区（默认 UTC）',
    'only tree, otherwise required': '唯一的树，否则条件必填',
    'tree root': '树根', 'tree root (MOVE)': '移到树根',
    'preserve current': '保留现值', 'unchanged': '不变', 'inherit': '继承',
    'null; conditional': 'null；条件规则见下文'
  };
  return translated[value] ?? value.replaceAll('API clamp', 'API 范围').replaceAll('clamp', '范围').replaceAll('max ', '上限 ');
}
function type(schema) {
  if (schema === true || !schema.type) return 'JSON (any value)';
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  return types.map(t => t === 'array' ? `array<${schema.items === true ? 'JSON' : type(schema.items || true)}>` : t === 'object' && schema.additionalProperties && schema.additionalProperties !== true ? `map<string,${type(schema.additionalProperties)}>` : t).join(' / ');
}
function table(tool, lang) {
  const properties = Object.entries(tool.inputSchema.properties || {});
  if (!properties.length) return word(lang, 'No fields. Pass `{}`; this tool does not accept a project selector.', '无字段，传 `{}`；本工具不接受项目选择参数。');
  const rows = [word(lang, '| Field | Type | Required | Omission / explicit null | Constraints and meaning |', '| 字段 | 类型 | 必填 | 省略 / 显式 null | 约束和含义 |'), '| --- | --- | --- | --- | --- |'];
  for (const [field, schema] of properties) {
    if (!fieldMeaning[field]) throw new Error(`Missing bilingual field explanation: ${field}`);
    const required = (tool.inputSchema.required || []).includes(field);
    let behavior = required ? word(lang, 'No default; missing/null is invalid.', '无默认值，缺失或 null 无效。') : localDefault(omission(tool.name, field), lang);
    if (!behavior) behavior = word(lang, 'Not supplied to API; conditional rules below.', '不向 API 提供，条件规则见下文。');
    if (!required) behavior += word(lang, '; null = omitted.', '；null 等同省略。');
    const constraints = schema === true ? [] : ['minimum', 'maximum', 'format', 'default', 'enum'].filter(k => Object.hasOwn(schema, k)).map(k => `${k}: ${JSON.stringify(schema[k])}`);
    rows.push(`| \`${field}\` | ${esc(type(schema))} | ${required ? word(lang, 'yes', '是') : word(lang, 'no (may be conditional)', '否（可能条件必填）')} | ${esc(behavior)} | ${esc([...constraints, fieldMeaning[field][lang]].join('; '))} |`);
  }
  return rows.join('\n');
}
for (const lang of ['en', 'zh-cn']) {
  const dir = new URL(`src/content/docs/${lang}/mcp/`, root);
  await mkdir(dir, { recursive: true });
  for (const tool of contract.tools) {
    const n = notes[tool.name];
    const args = tool.name === 'list_projects' ? n.args : { project: 'mcp-lab', ...n.args };
    const request = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: tool.name, arguments: args } };
    const envelope = { jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: JSON.stringify(n.expected) }], isError: false } };
    const heading = word(lang, `\`${tool.name}\` — ${n.title[lang]}`, `\`${tool.name}\` — ${n.title[lang]}`);
    const sections = [
      `---\ntitle: ${JSON.stringify(tool.name + ' — ' + n.title[lang])}\ndescription: ${JSON.stringify(n.summary[lang])}\ndoc_id: mcp.${tool.name}\nverified_release: '1.1.0'\nchannel: stable\ncontract_ids: [mcp.${tool.name}]\n---`,
      `# ${heading}\n\n${n.summary[lang]}`,
      word(lang, 'Stable Viat 1.1.0. Start with [MCP configuration and result handling](overview.md). The examples below are synthetic, source-derived expected shapes, **not executed responses**. No service, provider or device was contacted to prepare this page.', '适用于稳定版 Viat 1.1.0。先阅读 [MCP 配置与结果处理](overview.md)。以下为合成的、从源码推导的预期形状，**不是已执行的响应**。编写本页没有访问服务、提供方或设备。'),
      `## ${word(lang, 'Prerequisites and permissions', '前提与权限')}\n\n${permissions[n.role][lang]}\n\n${word(lang, 'Use an activated isolated instance, configured server/bearer, and an existing `mcp-lab` project except for list_projects. Examples using existing assets/IDs assume the fixtures in the overview; replace synthetic IDs with the IDs returned there. They are not self-provisioning.', '使用已激活的隔离实例，配置服务器和 bearer；除 list_projects 外须有 `mcp-lab` 项目。示例中的现有资产和 ID 以概览夹具为前提，用夹具实际返回 ID 替换合成 ID；示例不会自行创建依赖。')}`,
      `## ${word(lang, 'Complete input fields', '完整输入字段')}\n\n${word(lang, 'Required is the exported input contract’s structural requirement, not the full conditional API validation. For optional fields, explicit JSON null deserializes like omission, including unconstrained JSON fields. Empty strings/arrays/objects are actual values, not omission. Numeric formats describe serialization bounds; runtime clamps/defaults are separate. Schema `default:null` on args is not its effective runtime default `{}`.', '必填表示导出输入合约的结构要求，不等于完整条件 API 验证。可选字段的显式 JSON null 与省略同样反序列化，包括未限定类型的 JSON 字段。空字符串、数组或对象是实际值，不是省略。数值 format 表示序列化边界，运行时限制和默认值另算。args 的模式 `default:null` 不等于其运行时默认 `{}`。')}\n\n${table(tool, lang)}`,
      `## ${word(lang, 'Behavior and validation', '行为与验证')}\n\n${n.semantics[lang]}`,
      ...(tool.name === 'create_endpoint' ? [endpointJson[lang]] : tool.name === 'update_endpoint_info' ? [word(lang, 'For every nested JSON field, use the [complete API object descriptions](create_endpoint.md#json-objects-accepted-by-the-api); the same validation applies here.', '所有嵌套 JSON 字段请参阅 [完整 API 对象说明](create_endpoint.md#api-接受的-json-对象)，本工具采用相同验证。')] : []),
      `## ${word(lang, 'Output and pagination', '输出与分页')}\n\n${n.output[lang]}\n\n${n.pagination[lang]}\n\n${word(lang, 'The value is JSON serialized inside one MCP `content` text block. Parse `result.content[0].text` as JSON. There is no promised `structuredContent` or `outputSchema`. Optional fields documented as omitted must not be assumed to exist with null.', '值会序列化成 JSON，放进一个 MCP `content` 文本块。请把 `result.content[0].text` 解析为 JSON。不承诺 `structuredContent` 或 `outputSchema`；注明省略的可选字段不能假定以 null 存在。')}`,
      `## ${word(lang, 'Synthetic request and expected shape', '合成请求与预期形状')}\n\n${word(lang, 'After MCP initialize/initialized, send this tools/call request as one JSON line over stdio (pretty-printed here for readability).', '完成 MCP initialize/initialized 后，通过 stdio 以单行 JSON 发送此 tools/call 请求（此处格式化仅为便于阅读）。')}\n\n${json(request)}\n\n${word(lang, 'Expected MCP envelope shape (IDs, timestamps, headers and computed values are illustrative, not deterministic assertions).', '预期 MCP 外层形状（ID、时间戳、头和计算值均为示意，不是确定值断言）。')}\n\n${json(envelope)}\n\n${word(lang, 'Decoded JSON value in the text block:', '文本块内解码后的 JSON 值：')}\n\n${json(n.expected)}`,
      `## ${word(lang, 'Failures and recovery', '失败与恢复')}\n\n${n.failure[lang]}\n\n${word(lang, 'All upstream tools can fail with expired/revoked tokens, PAT confinement, project access denial, activation, network or timeout errors. Missing project/default gives `project_required`; control-plane non-2xx gives `http_4xx`/`http_5xx`. See the [exact shared error envelope and retry rules](overview.md). Input deserialization/unknown tool failures can be JSON-RPC protocol errors before the tool-layer envelope; do not assume every failure has isError. A retryable flag is not an idempotency guarantee.', '所有上游工具都可能因令牌过期或撤销、PAT 范围、项目权限、激活、网络或超时失败。无项目及默认值时为 `project_required`；控制面非 2xx 为 `http_4xx`/`http_5xx`。详见 [公共错误外层及重试规则](overview.md)。输入反序列化或未知工具可能在进入工具层前成为 JSON-RPC 协议错误，不要假定每个失败都有 isError。retryable 标志不保证幂等。')}`,
      `## ${word(lang, 'Side effects, verification and cleanup', '副作用、验证与清理')}\n\n${n.effects[lang]}\n\n${word(lang, 'Verification is observational: inspect the documented result fields and use the corresponding read tools before and after any authorized mutation. Do not verify by sending production traffic or deleting unrelated objects.', '验证应以观察为主：检查本文结果字段，获准修改前后使用对应读取工具。不要通过生产请求或删除无关对象来验证。')}`,
      `## ${word(lang, 'Maintenance evidence', '维护依据')}\n\n${word(lang, 'Input inventory: `contracts/1.1.0/mcp-tools.json`, tool', '输入清单：`contracts/1.1.0/mcp-tools.json`，工具')} \`${tool.name}\`. ${word(lang, 'Implementation/tests under the pinned product source:', '固定产品源码中的实现和测试：')} \`${n.source}\`. ${word(lang, 'Tool module filenames refer to `crates/viat-mcp/src/tools/`; API handlers refer to `crates/viat-api/src/handlers/`. Shared transport/error evidence: `crates/viat-mcp/src/tools/service.rs`, `http.rs`, `error.rs`; tests were inspected, not run for this documentation change.', '工具模块文件名相对 `crates/viat-mcp/src/tools/`，API handler 相对 `crates/viat-api/src/handlers/`。公共传输和错误依据为 `crates/viat-mcp/src/tools/service.rs`、`http.rs`、`error.rs`；本次仅阅读测试，没有运行测试。')}`
    ];
    await writeFile(new URL(`${tool.name}.md`, dir), await escapeGeneratedHtml(sections.join('\n\n') + '\n'));
  }
}
console.log(`Wrote ${names.length * 2} tool pages under ${fileURLToPath(new URL('src/content/docs/', root))}; overview pages are hand-authored.`);
