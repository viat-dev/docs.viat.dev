import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resources, pair } from '../content/resource-notes.mjs';
import { escapeGeneratedHtml } from './lib/markdown.mjs';

// This only authors the assigned Markdown pages; it never executes examples or contacts services.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contract = JSON.parse(await readFile(path.join(root, 'contracts/1.1.0/resources.json'), 'utf8'));
const meanings = {
  host: pair('Server hostname/IP, not a URL or credential.', '服务主机名/IP，不是 URL 或凭据。'),
  hosts: pair('MongoDB seed hostname list; SRV changes allowed shape.', 'MongoDB 种子主机列表，SRV 会改变允许格式。'),
  port: pair('TCP port. Explicitly supply it where required; TLS does not infer a port.', 'TCP 端口，必填时须显式提供，TLS 不会推导端口。'),
  database: pair('Target business database, not the platform database.', '目标业务数据库，不是平台数据库。'),
  ssl: pair('Stored TLS preference; see the version-specific runtime limitations below.', '存储的 TLS 偏好，运行时版本限制见下文。'),
  tls: pair('Connection transport mode; see provider-specific requirements below.', '连接传输模式，具体要求见下文。'),
  user: pair('Database login, encrypted with the secret half.', '数据库登录用户，与 secret 一起加密。'),
  username: pair('Account name; optional/anonymous rules differ by kind.', '账号名，可选/匿名规则随类型而异。'),
  password: pair('Account password/app password, never a plaintext config setting.', '账号密码/应用密码，不应作为明文配置。'),
  base_url: pair('Configured upstream base/transport override; not a per-call destination.', '配置的上游 base/传输覆盖地址，不是逐调用目的地。'),
  custom_headers: pair('Every-request string headers; use whole-value $secret: references for credentials.', '每请求字符串头，凭据使用完整值 $secret: 引用。'),
  headers: pair('Every-query string headers; literal values are readable/exportable.', '每查询字符串头，原始值可读取/导出。'),
  proxy: pair('Optional proxy URL; broker helpers apply it on the platform. Do not embed passwords in plain.', '可选代理 URL，代理助手在平台侧应用，不要在 plain 内嵌密码。'),
  auth_type: pair('Authentication selector, not an authorization grant.', '认证方式选择，不是授权规则。'),
  identity_assert: pair('Proxy-only signed X-Viat-Identity assertion.', '仅代理使用的签名 X-Viat-Identity 断言。'),
  identity_forward_token: pair('Proxy-only forwarding of the original external token.', '仅代理转发原始外部 token。'),
  identity_ttl_secs: pair('Minted identity-token lifetime: runtime default 60 seconds, maximum 3600.', '签发身份 token 有效期，运行时默认 60 秒、上限 3600。'),
  token: pair('Bearer/header-key token selected by auth_type.', '由 auth_type 选择的 bearer/header-key token。'),
  header_name: pair('Credential header name for header_key, stored in the secret half.', 'header_key 的凭据头名称，存于 secret。'),
  provider: pair('Wire protocol/provider selector; conditional requirements follow below.', '协议/提供方选择，条件必填要求见下文。'),
  model: pair('Configured model identifier; Azure uses a deployment name. No discovery/substitution.', '所配模型标识，Azure 使用部署名，不会发现/替换。'),
  endpoint: pair('Configured service endpoint; exact base-vs-operation and normalization rules depend on kind.', '配置的服务端点，base/操作 URL 和规范化规则依类型而定。'),
  api_key: pair('Provider API credential, applied by the platform.', '提供方 API 凭据，由平台应用。'),
  extra_params: pair('Arbitrary JSON request-body overrides; review as behavior, not harmless labels.', '任意 JSON 请求体覆盖项，应按行为而非无害标签审查。'),
  bucket: pair('Existing bucket name only, not a URL/path.', '现有桶名，不是 URL/路径。'),
  region: pair('Signing/operation region; provider rules may require it.', '签名/操作区域，提供方规则可能要求必填。'),
  path_style: pair('Use endpoint/bucket/key rather than bucket.endpoint/key.', '使用 endpoint/bucket/key，而非 bucket.endpoint/key。'),
  allowed_authorizers: pair('Deprecated plain S3 compatibility field; ignored by current request authorization.', '已废弃 plain S3 兼容字段，当前请求授权不使用。'),
  access_key: pair('S3-compatible access-key identifier.', 'S3 兼容访问 key 标识。'),
  secret_key: pair('S3-compatible signing secret.', 'S3 兼容签名秘密。'),
  session_token: pair('Optional temporary STS token; rotate before expiry, no automatic refresh.', '可选临时 STS token，到期前轮换，不自动刷新。'),
  auth_token: pair('Optional stored bearer used in token auth mode.', 'token 认证模式使用的可选已存 bearer。'),
  description: pair('Non-secret human description.', '非秘密的人类可读描述。'),
  value: pair('Opaque nonempty secret string intentionally readable by approved scripts.', '不透明非空秘密字符串，有意供获批准脚本读取。'),
  data: pair('The actual config document; create/PUT requires non-null data here.', '实际配置文档，创建/PUT 在此要求非 null。'),
  schema: pair('Restricted JSON Schema for config data; not the resource-kind schema.', '配置数据的受限 JSON Schema，不是资源类型 schema。'),
  api_version: pair('Cloud product API version; per-call override supported.', '云产品 API 版本，支持逐调用覆盖。'),
  service: pair('TC3 signing service, otherwise inferred from endpoint hostname.', 'TC3 签名服务，省略从端点主机名推导。'),
  access_key_id: pair('Cloud credential identifier, literal or a secret-resource reference.', '云凭据标识，可为原值或 secret 资源引用。'),
  access_key_secret: pair('Cloud signing secret, literal or a secret-resource reference.', '云签名秘密，可为原值或 secret 资源引用。'),
  security_token: pair('Optional cloud STS token, literal or secret-resource reference.', '可选云 STS token，可为原值或 secret 资源引用。'),
  from_address: pair('Fixed envelope/header From; scripts cannot override it.', '固定信封/头部 From，脚本不可覆盖。'),
  from_name: pair('Optional fixed sender display name, no CR/LF.', '可选固定发件显示名，不可含 CR/LF。'),
  db: pair('Redis unsigned logical database index, not an access-control boundary.', 'Redis 无符号逻辑数据库索引，不是访问控制边界。'),
  srv: pair('Enable mongodb+srv DNS discovery; one hostname, no port.', '启用 mongodb+srv DNS 发现，单主机且无端口。'),
  options: pair('MongoDB URI query options, not credentials.', 'MongoDB URI 查询选项，不应放凭据。'),
  vhost: pair('AMQP virtual host, encoded as a path segment.', 'AMQP 虚拟主机，编码为路径段。'),
  instance: pair('SQL Server named instance; when present it overrides configured port discovery.', 'SQL Server 命名实例，提供时通过发现替代配置端口。'),
  encryption: pair('SQL Server required/trust_cert/off transport choice.', 'SQL Server required/trust_cert/off 传输选择。'),
  algorithm: pair('Cryptographic key type; operation modes are separate call arguments.', '密钥类型，操作模式是单独调用参数。'),
  key_encoding: pair('Non-PEM key decoding; auto is algorithm-specific.', '非 PEM key 解码方式，auto 按算法决定。'),
  public_key: pair('Public asymmetric key, exportable; derived if only private material is supplied.', '可导出非对称公钥，仅提供私钥时可推导。'),
  key_id: pair('Crypto envelope/JWT key label, or APNs signing-key identifier for push.', 'crypto 信封/JWT key 标签，push 中为 APNs 签名 key 标识。'),
  key: pair('Symmetric key material for aes/hmac/sm4, encoded per key_encoding.', 'aes/hmac/sm4 对称 key，按 key_encoding 编码。'),
  private_key: pair('Asymmetric private material; absent allows supported public-only operations.', '非对称私钥材料，省略时仅可用受支持公钥操作。'),
  previous_key: pair('Rotation slot for AES sealed tokens/HMAC verification only.', '仅 AES 封装 token/HMAC 验证的轮换槽。'),
  backend: pair('Managed file byte backend: local or s3; metadata is always project PostgreSQL.', '受管字节后端 local/s3，元数据始终为项目 PostgreSQL。'),
  root: pair('Server-side absolute local-storage directory under operator allow-listed roots.', '运维允许根目录内的服务端绝对本地存储目录。'),
  prefix: pair('Relative backend key prefix; include trailing / if desired.', '相对后端键前缀，目录式用法应含末尾 /。'),
  max_file_bytes: pair('Per-file ceiling; 0 uses deployment cap, resource can only lower it.', '单文件上限，0 用部署上限，资源只能降低。'),
  allowed_types: pair('Permitted declared MIME types; [] means any, not content security scanning.', '允许的声明 MIME 类型，[] 表示任意，不是内容安全扫描。'),
  metadata: pair('Project PostgreSQL resource/table holding managed file rows.', '保存受管文件行的项目 PostgreSQL 资源/表。'),
  resource: pair('Folder-aware resource reference; storage metadata must target postgresql.', '按文件夹解析的资源引用，storage 元数据须指向 postgresql。'),
  table: pair('Audit trail or metadata table name; runtime defaults documented below.', '审计/元数据表名，运行时默认见下文。'),
  path: pair('Absolute server-only SQLite file under VIAT_SQLITE_ROOTS; never the platform DB.', 'VIAT_SQLITE_ROOTS 内的纯服务端绝对 SQLite 文件，不是平台数据库。'),
  read_only: pair('SQLite-enforced read-only opening.', '由 SQLite 执行的只读打开。'),
  create_if_missing: pair('Create an empty SQLite file at first connect when writable; ignored when read_only.', '可写时首次连接创建空 SQLite 文件，read_only 时忽略。'),
  script: pair('Resource-folder-relative frozen Rust/binary export script reference.', '相对资源文件夹解析的冻结 Rust/binary 导出脚本引用。'),
  app_key: pair('JPush public app key, paired with master_secret.', 'JPush 公开 app key，配 master_secret。'),
  apns_production: pair('JPush APNs distribution environment switch, false by default.', 'JPush APNs 分发环境开关，默认 false。'),
  project_id: pair('FCM Firebase project identifier, not a Viat project UUID.', 'FCM Firebase 项目标识，不是 Viat 项目 UUID。'),
  bundle_id: pair('APNs app bundle/topic identifier.', 'APNs 应用 bundle/topic 标识。'),
  environment: pair('APNs sandbox or production, deliberately no implicit environment.', 'APNs sandbox/production，故意不提供隐含环境。'),
  master_secret: pair('JPush private half.', 'JPush 私密半部。'),
  service_account: pair('FCM complete service-account JSON encoded as one encrypted string.', 'FCM 完整服务账号 JSON，作为一个加密字符串。'),
  p8_key: pair('APNs EC signing-key PEM.', 'APNs EC 签名 key PEM。'),
  team_id: pair('APNs Apple developer team identifier.', 'APNs Apple 开发者团队标识。'),
  audit: pair('PostgreSQL-only business audit declaration; saving can install DDL.', '仅 PostgreSQL 的业务审计声明，保存可安装 DDL。'),
  graphql_overlay: pair('TOML overlay for the database GraphQL engine, not a GraphQL request.', '数据库 GraphQL 引擎的 TOML 覆盖层，不是 GraphQL 请求。'),
  graphql_schemas: pair('Ordered PostgreSQL schemas; empty means public, later schemas get prefixes.', '有序 PostgreSQL schema，空表示 public，后续 schema 加前缀。'),
  authz_tables: pair('Exposed table → authorization type or {type,actions}; bound engines deny unbound tables.', '暴露表 → 授权类型或 {type,actions}，有绑定的引擎拒绝未绑定表。'),
  type: pair('Authorization-model type name in the long-form table binding.', '长形式表绑定中的授权模型类型名。'),
  actions: pair('Implied read/create/update/delete → model action name; omitted entries retain their own name.', '隐含 read/create/update/delete → 模型操作名，未列项保留同名。'),
  tables: pair('Audited table names or full per-table declarations.', '被审计表名或逐表完整声明。'),
  unattributed: pair('Policy for unattributed writes: reject/record; absent uses deployment default reject.', '未归属写入策略 reject/record，省略用部署默认 reject。'),
  lock_down: pair('Try to revoke trail UPDATE/DELETE from resource role, default true.', '尝试撤销资源角色对审计表 UPDATE/DELETE，默认 true。'),
  name: pair('Audited table name, optionally schema-qualified; bare means public.', '被审计表名，可带 schema，裸名表示 public。'),
  reason_required: pair('Refuse writes without an audit reason, default false.', '缺审计原因则拒绝写，默认 false。'),
  ignore_columns: pair('Suppress these columns only from update field rows, default [].', '仅从更新字段行抑制这些列，默认 []。')
};

const j = v => JSON.stringify(v);
const cell = s => String(s).replaceAll('|', '&#124;').replaceAll('\n', ' ');
function describeType(s, definitions = {}) {
  if (s === true || s == null) return 'JSON';
  if (s === false) return 'never';
  if (s.$ref) return s.$ref.split('/').at(-1);
  if (s.enum) return s.enum.map(j).join(' / ');
  for (const key of ['oneOf','anyOf','allOf']) if (s[key]) return s[key].map(x => describeType(x,definitions)).join(key === 'allOf' ? ' & ' : ' / ');
  if (s.type === 'array') return `array<${describeType(s.items,definitions)}>`;
  if (s.type === 'object' && s.additionalProperties && s.additionalProperties !== true) return `map<string, ${describeType(s.additionalProperties,definitions)}>`;
  return Array.isArray(s.type) ? s.type.join(' / ') : (s.type ?? 'JSON');
}
function constraints(s, lang) {
  const out = [];
  for (const k of ['minimum','maximum','minLength','maxLength','minItems','maxItems','pattern','format']) if (s[k] !== undefined) out.push(`${k}: ${j(s[k])}`);
  if (s.format === 'uint16') out.push('0–65535');
  if (s.format === 'uint32') out.push('0–4294967295');
  if (s.format === 'uint64') out.push('0–18446744073709551615');
  if (s.additionalProperties === false) out.push(lang ? '拒绝未知键' : 'unknown keys rejected');
  return out.join('; ') || '—';
}
const runtimeDefaults = {
  'plain.audit': null, 'plain.authz_tables': {},
  'AuditConfig.lock_down': true, 'AuditConfig.tables': [],
  'AuditConfig.schema': 'public', 'AuditConfig.table': 'viat_audit',
  'AuditConfig.unattributed': 'deployment (reject by default)',
  'AuthzTableMapping.actions': {}, 'StorageMetadata.table': 'viat_files',
  'AuditTable.reason_required': false, 'AuditTable.ignore_columns': []
};
function table(s, lang, prefix) {
  let text = s.additionalProperties === false ? (lang?'未知键会被拒绝。\n\n':'Unknown keys are rejected.\n\n') : '';
  text += lang ? '| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |\n| --- | --- | --- | --- | --- | --- |\n' : '| Field | Type / allowed values | Required | Omitted default | Constraints | Meaning |\n| --- | --- | --- | --- | --- | --- |\n';
  for (const [name,p] of Object.entries(s.properties ?? {})) {
    const required = (s.required ?? []).includes(name);
    const defaultValue = Object.hasOwn(runtimeDefaults,`${prefix}.${name}`) ? runtimeDefaults[`${prefix}.${name}`] : p.default;
    let meaning = meanings[name]?.[lang] ?? (lang ? '嵌套结构，详见本节类型定义与规则。' : 'Nested structure; see its type definition and rules in this section.');
    if (name === 'schema' && prefix.startsWith('Audit')) meaning = lang ? '审计表/函数的 schema，默认 public。' : 'Schema for audit table/functions, runtime default public.';
    text += `| \`${prefix}.${name}\` | ${cell(describeType(p,s.definitions))} | ${required ? (lang?'是':'yes') : (lang?'否；可能条件必填':'no; may be conditional')} | ${defaultValue !== undefined ? '\`'+cell(j(defaultValue))+'\`' : (required ? '—' : (lang?'无显式默认；见规则':'no explicit default; see rules'))} | ${cell(constraints(p,lang))} | ${cell(meaning)} |\n`;
  }
  return text;
}
function definitions(s,lang) {
  let text='';
  for (const [name,def] of Object.entries(s.definitions ?? {})) {
    text += `\n#### \`${name}\`\n\n`;
    if (name === 'AuditTable') {
      text += lang ? '实际输入是表名字符串，或以下对象；导出 schema 暴露规范化结构，不能将其三个 required 字段直接当作写入要求。\n\n' : 'Actual input is a table-name string or the object below. The exported schema exposes a normalized structure; its three required fields are not all required on writes.\n\n';
      text += table({...def,required:['name']},lang,name);
    } else if (def.properties) text += table(def,lang,name);
    else {
      text += (lang ? '允许结构/值：' : 'Allowed shape/values: ') + '\`'+cell(describeType(def,s.definitions))+'\`'+(lang?'。\n':'.\n');
      for (const [i,branch] of (def.oneOf ?? def.anyOf ?? []).entries()) {
        if (branch.properties) text += '\n'+table(branch,lang,`${name}[${i+1}]`);
      }
    }
    if (name === 'SecretField') text += lang ? '\n字符串原值，或仅含 `$secret` 字符串键的对象（例如 `{"$secret":"cloud_key"}`）。schema 的 map 形状不代表任意多键对象都可用；运行时会检查精确引用和 secret 类型目标。\n' : '\nA literal string, or an object with only a string `$secret` key (for example `{"$secret":"cloud_key"}`). The map schema does not authorize arbitrary multi-key objects: runtime validates exact references and secret-kind targets.\n';
    if (name === 'AuthzTableBinding') text += lang ? '\n字符串是授权类型简写；对象使用下方 AuthzTableMapping。映射键为暴露表名，不是任意数据库限定名。\n' : '\nA string is the authorization-type shorthand; an object uses AuthzTableMapping below. Map keys are exposed table names, not arbitrary database-qualified names.\n';
  }
  return text;
}
function fields(r,lang) {
  let text = lang ? '## 完整配置字段\n\n表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。\n' : '## Complete configuration fields\n\nRequired describes structural parsing; conditional provider/backend requirements, runtime defaults and limitations follow below. Use null only where the type allows it. Numeric storage bounds do not imply every value is operationally valid. Do not rely on unknown-key dropping to detect typos.\n';
  for(const half of ['plain','secret']) {
    const s = r.schemas[half];
    text += `\n### \`${half}\`\n\n`;
    if (!Object.keys(s.properties ?? {}).length) text += lang ? '空对象 `{}`，本类型在这一半没有字段。\n' : 'Empty object `{}`; this half declares no fields.\n';
    else text += table(s,lang,half);
    text += definitions(s,lang);
  }
  return text;
}
function shared(lang) {
  return lang ? `## 权限、身份与保存语义

管理 API 需要平台登录及项目成员身份。列举/查看需要成员身份；创建、PUT、PATCH、Test、refresh、copy、delete 需要有效项目角色 Owner/Admin/Developer；较低权限的 operator 角色不可写。管理权限不自动赋予上游账号权限，也不替代运行时的 s3/file/行级授权。MCP 只开放其工具清单实际声明的能力，不能把资源 schema 当作完整 MCP CRUD。

- 创建：\`POST /projects/{slug}/resources\`，请求为 \`{name,folder?,kind,plain,secret}\`。name 长度 1–64 字节且不可含 /；system 为保留名。folder 省略/空字符串表示根，非空为 [A-Za-z0-9_-]+ 段，最多 8 层/255 字节，无首尾或连续 /。
- 资源身份为同项目 \`(folder,name)\`，不是全项目裸名。同名可以位于不同文件夹。详情路由用 \`/resources/{name}?folder=team\` 显式定位；CLI 用 \`team/name\`。脚本裸引用按自身文件夹、根、全项目唯一名顺序解析，建议跨文件夹显式限定，Python 用 \`getattr(ctx.resources, "team/name")\`，TypeScript 用 \`ctx.resources["team/name"]\`，而非属性链。
- PUT 是完整替换：须重发正确 kind、完整 plain 与全部要保留的秘密值，不能从 show 的掩码恢复秘密。PATCH 的 kind 固定；省略 plain 保留，提供 plain 则整体替换（不是深合并）；secret 仅逐字段覆盖，省略字段保留。移动 folder 时引用在新位置重检。
- 清除可选秘密用 PATCH 显式 null（仅允许 null 的字段）或空字符串（仅允许空值的字段）；必需/条件必需字段不能清空。清除可选 plain 字段需发送去掉该字段的完整 plain，让类型默认/缺省生效。不要用 null 代替所有类型，也不要把 *** 当作旧值。
- \`$keep\` 是仅 PATCH/仓库同步使用的**顶层 plain 字段**占位符，保留服务端已有同名字段，连数字/布尔也可保留；新资源/不存在字段不能使用。嵌套 \`$keep\` 不是深合并指令。
- 仓库文件 \`resources/<folder>/<name>.yaml\` 由路径承载 folder，name 仍是裸名。\`viat pull\` 将 secret 字段写为字符串 \`$secret\`；\`viat push\` 去掉这些占位（也接受旧 !secret 标签），对已有资源 PATCH，绝不把占位当凭据。新资源必须先安全提供实际必需秘密；占位不能创建凭据。顶层 allowed_authorizers 是仓库访问同步元数据，不要擅自塞进 plain。

\`$secret\` 占位与凭据引用不同：\`{"$secret":"name"}\` 在 config/cloud 支持位置命名另一个 secret 资源；HTTP/GraphQL 字符串头用整个 \`"$secret:name"\`。它们不等于秘密明文，保存/读取/导出保留引用，使用时解析。目标按消费资源文件夹锚定并须已存在且为 secret 类型，不能用字符串拼接插值。

公开响应含资源标识、kind、folder、plain 及秘密摘要，不返回秘密值；摘要 *** 表示该种类声明的字段，不证明每个可选凭据实际已填。plain 会原样可读/导出；secret 通过部署秘密后端加密。脚本/依赖的发布版本按快照规则冻结，uses 无 (live) 时亦冻结，不可把所有依赖描述为每次读 live；资源读取/代理操作和显式实时 secret IO 是不同边界。
` : `## Permissions, identity and save semantics

Management API requires platform authentication and project membership. List/show require membership; create, PUT, PATCH, Test, refresh, copy and delete require an effective project Owner/Admin/Developer role; the lower-privilege operator role cannot write. Management access grants neither upstream privileges nor runtime s3/file/row-policy access. MCP exposes only its actual listed tools; a resource schema is not a full MCP CRUD interface.

- Create: \`POST /projects/{slug}/resources\`, body \`{name,folder?,kind,plain,secret}\`. name is 1–64 bytes without /; system is reserved. Omitted/empty folder means root; otherwise [A-Za-z0-9_-]+ segments, at most 8 levels/255 bytes, no leading/trailing/repeated /.
- Identity is project-local \`(folder,name)\`, not a global bare name. Duplicate names may exist in different folders. Use \`/resources/{name}?folder=team\` to locate detail routes explicitly; CLI uses \`team/name\`. Script bare names resolve own folder, root, then globally unique name; qualify cross-folder references, using Python \`getattr(ctx.resources, "team/name")\` or TypeScript \`ctx.resources["team/name"]\`, not a property chain.
- PUT fully replaces: resend correct kind, complete plain and all secret values to retain; show masks cannot recover them. PATCH fixes kind; omitted plain preserves it, supplied plain replaces the entire document (not a deep merge); secret overlays only supplied fields, retaining omitted fields. Folder moves recheck references at the new anchor.
- Clear an optional secret by explicit null (only nullable fields) or empty string (only fields allowing empty). Required/conditionally required fields cannot be cleared. To clear optional plain fields, send complete plain without them so defaults/absence take effect. Null is not universal and *** is never an old-secret value.
- \`$keep\` is a PATCH/repo sentinel only at **top-level plain fields**, retaining an existing server value even for numeric/boolean fields. It cannot initialize a new resource or missing field. Nested \`$keep\` is not a deep-merge instruction.
- Repo file \`resources/<folder>/<name>.yaml\` carries folder through its path, with a bare name inside. \`viat pull\` writes string \`$secret\` placeholders for secret fields; \`viat push\` removes them (also accepts legacy !secret tags) and PATCHes existing resources, never using markers as credentials. Safely supply real required secrets before creating a new resource; a placeholder cannot create credentials. Top-level allowed_authorizers is repo access-sync metadata, not something to insert into plain arbitrarily.

The \`$secret\` placeholder differs from a credential reference: \`{"$secret":"name"}\` names another secret resource in supported config/cloud positions; HTTP/GraphQL string headers use the entire \`"$secret:name"\` value. These are not plaintext credentials. Save/read/export retain references; use resolves them. Targets resolve relative to the consuming resource folder and must already exist with kind secret. No substring interpolation.

Public responses contain resource identifiers, kind, folder, plain and a secret summary, never secret values. Summary *** denotes declared fields, not proof every optional credential is populated. Plain is readable/exportable; secret uses the deployment encrypted backend. Published script/dependency code follows snapshot rules: uses is frozen unless (live), not blanket live on every run. Resource projection, broker operations and explicit live secret IO are different boundaries.
`;
}
function exposure(note,lang) {
  const texts={
    broker:pair('Provider credential/private material is applied by the platform’s broker operation, not handed to the script helper. Do not use removed r.secret/r.auth_headers patterns. Plain literal headers/config remain visible: use references in supported positions.', '提供方凭据/私密材料由平台代理操作应用，不交给脚本助手。不可使用已移除的 r.secret/r.auth_headers 写法。plain 原始头/配置仍可见，应在支持位置使用引用。'),
    url:pair('**1.1.0 compatibility/security limitation:** this kind’s active runtime projection still injects a credential-bearing connection URL into the worker, even though the recommended operations below are brokered and do not need it. Treat the script and its dependency tree as trusted with that credential. Do not log/return the resource or extract a URL into application code; prefer the brokered helpers and least-privilege upstream credentials. Encryption at rest and CRUD masking do not remove this worker exposure.', '**1.1.0 兼容/安全限制：** 本类型实际运行投影仍向 worker 注入含凭据连接 URL，虽然下列推荐操作由平台代理且不需要它。脚本及其依赖树应视为能接触该凭据。不要记录/返回整个资源，不要提取 URL 到应用代码；优先代理助手与最小上游权限。静态加密和 CRUD 掩码不能消除此 worker 暴露。'),
    ado:pair('**1.1.0 compatibility/security limitation:** active SQL Server projection still includes credential-bearing ADO/username/password metadata. Brokered query/transaction operations do not need scripts to read it. Do not extract or log it; trust the whole dependency tree accordingly and use least-privilege SQL accounts. CRUD masking is not worker isolation.', '**1.1.0 兼容/安全限制：** 实际 SQL Server 投影仍含带凭据 ADO/username/password 元数据。代理 query/transaction 不需要脚本读取它，不要提取或记录；依赖树均应按能接触凭据审查，使用最小权限 SQL 账号。CRUD 掩码不等于 worker 隔离。'),
    s3:pair('**1.1.0 compatibility/security limitation:** active projection still includes S3 access_key/secret_key/session_token fields. Prefer the brokered operations below, which preserve platform policy; do not extract keys into application code or log/return the resource. Every script dependency must be trusted with this exposure. Managed storage avoids exposing backend credentials.', '**1.1.0 兼容/安全限制：** 实际投影仍包含 S3 access_key/secret_key/session_token。优先下列保留平台策略的代理操作，不要将 key 提取到应用代码或记录/返回资源。全部脚本依赖须按此暴露审查，受管 storage 不暴露后端凭据。'),
    value:pair('Secret values intentionally reach scripts through .value; this is different from a provider authentication credential applied by a broker. Restrict declarations/dependencies and never return the value to an endpoint caller.', '秘密值有意通过 .value 进入脚本，区别于代理应用的提供方认证凭据。限制声明/依赖，绝不将值返回端点调用者。'),
    config:pair('The stored document is plaintext; referenced secret values intentionally reach consuming scripts after hydration. This is not brokered credential isolation. Restrict scripts/dependencies and never return the whole resolved document.', '存储文档是明文，引用秘密在解析后有意进入消费脚本，这不是代理凭据隔离。限制脚本/依赖，不要返回整个解析文档。')
  };
  return texts[note.exposure][lang];
}
function rustExample(n) {
  const [op,req] = n.rust;
  let statement;
  if(op==='library') statement=`ctx.library("demo").call("${req.function}", json!(${j(req.args)}))`;
  else if(op==='meta') statement='Ok(json!({"configured": ctx.resource("demo").meta().get("value").and_then(Value::as_str).map(|s| !s.is_empty()).unwrap_or(false)}))';
  else if(op==='config') statement='Ok(json!({"batch": ctx.resource("demo").meta()["data"]["batch"], "enabled": ctx.resource("demo").meta()["data"]["enabled"]}))';
  else statement=`ctx.resource("demo").call("${op}", json!(${j(req)}))`;
  return `// @resource demo\nuse serde_json::{json, Value};\nuse viat::{Ctx, Error};\n\nfn main() {\n    viat::serve(|ctx: &Ctx, _args: Value| -> Result<Value, Error> {\n        ${statement}\n    });\n}`;
}
const sources = 'viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs';
for(const langCode of ['en','zh-cn']) {
  const lang = Number(langCode === 'zh-cn');
  const dir=path.join(root,'src/content/docs',langCode,'assets/resources');
  await mkdir(dir,{recursive:true});
  for(const r of contract.resources) {
    const n=resources[r.kind];
    if(!n) throw new Error(`Missing reviewed resource notes: ${r.kind}`);
    let md=`---\ntitle: ${j(n.title[lang])}\ndescription: ${j(n.intro[lang])}\ndoc_id: resource.${r.kind}\nverified_release: '1.1.0'\nchannel: stable\ncontract_ids: [resource.${r.kind}]\n---\n\n# ${n.title[lang]}\n\n${n.intro[lang]}\n\n`;
    md+= lang ? `本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。\n\n## 前置条件与权限\n\n${n.prerequisites[lang]}\n\n` : `Verified against stable Viat 1.1.0. Examples use synthetic values/provider stubs; they were not executed, connected to live services or used to send messages. Start with the [resource overview](index.md).\n\n## Prerequisites and permissions\n\n${n.prerequisites[lang]}\n\n`;
    md+=fields(r,lang);
    md+=`\n## ${lang?'运行规则、默认值与限制':'Runtime rules, defaults and limits'}\n\n${n.rules[lang]}\n\n${n.extra?.[lang] ?? ''}\n\n`;
    md+=shared(lang);
    md+=`\n## ${lang?'脚本秘密边界':'Script secret boundary'}\n\n${exposure(n,lang)}\n\n`;
    md+=`## ${lang?'最小配置：管理 API / CLI 文件':'Minimal configuration: management API / CLI file'}\n\n`;
    md+=lang ? '下面是创建请求 JSON，同时也是合法 YAML，可作为 `resource.yaml` 交给真实 CLI 命令。域名/凭据均为测试值，生产使用前须替换并完成前置条件；不要把真实 secret 文件提交仓库。\n\n' : 'This create-request JSON is also valid YAML for `resource.yaml` and the real CLI command below. Domains/credentials are fixtures; replace them and satisfy prerequisites before real use. Never commit a file containing actual secrets.\n\n';
    md+='```json\n'+JSON.stringify({name:'demo',folder:'',kind:r.kind,plain:n.plain,secret:n.secret},null,2)+'\n```\n\n';
    md+='```sh\nviat project select <slug>\nviat resource create --file resource.yaml\nviat resource show demo --json\n```\n\n';
    md+=lang ? '等价 API 为 `POST /projects/{slug}/resources`（相对实例管理 API 根），请求体如上。预期得到已保存资源的公开表示和掩码摘要，不是秘密回显；示例名已存在则 409。仓库同步时去掉 folder，把配置放 `resources/demo.yaml`；`viat push` 可同步完整 plain 及未被占位过滤的 secret。创建成功不保证每个远程动作成功。\n\n' : 'Equivalent API: `POST /projects/{slug}/resources`, relative to the instance management API root, with the body above. Expect the saved public resource and masked summary, not echoed secrets; an existing fixture name conflicts with 409. For repo sync omit folder and put it in `resources/demo.yaml`; `viat push` synchronizes complete plain and non-placeholder secret fields. Saving does not prove every remote operation works.\n\n';
    md+=`## ${lang?'SDK 操作与示例':'SDK operations and examples'}\n\n${n.operations[lang]}\n\n`;
    md+=lang ? '这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。\n\n' : 'Both complete scripts declare the same root resource demo. Use only an approved fixture run. Writes, sends, builds and deletion are not dry-run.\n\n';
    md+='### Python\n\n```python\n# @resource demo\nfrom viat import ctx\n\ndef main():\n'+n.py.split('\n').map(x=>'    '+x).join('\n')+'\n```\n\n';
    md+='### TypeScript\n\n```typescript\n// @resource demo\nimport { ctx } from "viat";\n\nexport async function main() {\n'+n.ts.split('\n').map(x=>'  '+x).join('\n')+'\n}\n```\n\n';
    if(n.rust) md+='### Rust\n\n'+(lang?'Rust 的已验证表面是 `ctx.resource(name)` 的通用 `call(op,req)`（library 用 `ctx.library`）；不是照搬 Python 方法名。下面展示对应协议调用，返回原始操作结果，可能不同于上方复合示例。\n\n':'The verified Rust surface uses generic `ctx.resource(name).call(op,req)` (library uses `ctx.library`), not invented Python-shaped methods. This shows the corresponding protocol operation and returns its raw result, which can differ from the composite example above.\n\n')+'```rust\n'+rustExample(n)+'\n```\n\n';
    md+=lang ? 'Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。\n\n' : 'Shell has JSON environment projection, not method-decorated ctx.resources; these methods are not shell functions. Binary programs can implement corresponding worker-protocol RPC, not automatically Python/TypeScript methods. The sql lane supports the four SQL kinds; viat_gql only PostgreSQL/MySQL/SQLite; graphql targets remote graphql; llm targets llm. Unsupported lane/kind combinations are not automatically adapted.\n\n';
    md+=`### ${lang?'预期结果':'Expected result'}\n\n${n.expected[lang]}\n\n## ${lang?'Test 行为与副作用':'Test behavior and side effects'}\n\n${n.test[lang]}\n\n`;
    md+=lang ? '管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。\n\n' : 'Management API: `POST /projects/{slug}/resources/{name}/test?folder=`; CLI: `viat resource test demo`. Inspect body ok: connection failures normally still return HTTP 200 `{ok:false,error:"…"}`, possibly with schema_warnings. Status alone is insufficient; CLI exits nonzero on failure. Run only after approving network/filesystem effects.\n\n';
    md+=`## ${lang?'常见失败与恢复':'Common failures and recovery'}\n\n${n.failures[lang]}\n\n`;
    md+=lang ? '管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。\n\n' : 'Management errors normally use {error,message}. DTO resource.<kind>.* identifiers often occur in the message of 400 bad_request, not the top-level error; they are not a universal enum returned by every runtime helper. For 401 restore platform auth, 403 check effective project role/runtime rules, 404 check folder/name, 409 resolve duplicate identity or resource_in_use references. Distinguish upstream refusals from platform refusals and determine whether work might already have applied before retrying.\n\n';
    md+=`## ${lang?'生产注意与清理':'Production pitfalls and cleanup'}\n\n${n.production[lang]}\n\n`;
    md+=lang ? '通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。\n\n' : 'General removal: disable callers, proxy/CRUD targets and related triggers, migrate dependencies and retain required evidence; then use `viat resource delete demo` or DELETE on the detail route. For 409 resource_in_use rebind/remove named endpoint holders first; do not bypass references. Removing an asset is not revoking third-party credentials, deleting external data or undoing prior side effects.\n\n';
    md+=`## ${lang?'相关资源与维护依据':'Related resources and maintenance evidence'}\n\n${n.related.map(k=>`- [${resources[k].title[lang]}](${k}.md)`).join('\n')}\n- [${lang?'资源总览':'Resource overview'}](index.md)\n\n`;
    md+=(lang?'固定契约：':'Pinned contract: ')+`\`contracts/1.1.0/resources.json\` → \`resource.${r.kind}\`。\n\n`+(lang?'核对实现（产品仓库相对路径）：':'Reviewed implementation (product-repository-relative paths): ')+sources+'.\n';
    await writeFile(path.join(dir,r.kind+'.md'),await escapeGeneratedHtml(md));
  }
  let index=`---\ntitle: ${j(lang?'资源参考总览':'Resource reference overview')}\ndescription: ${j(lang?'Viat 1.1.0 全部 20 种资源的配置、秘密边界和 SDK 使用参考。':'Configuration, secret boundaries and SDK use for all 20 Viat 1.1.0 resource kinds.')}\ndoc_id: resources.overview\nverified_release: '1.1.0'\nchannel: stable\ncontract_ids: []\n---\n\n# ${lang?'资源参考总览':'Resource reference overview'}\n\n`;
  index+=lang ? '资源是项目内有文件夹身份的配置资产，不是端点、不自动创建远程服务，也不自动启动触发器。本参考覆盖固定 1.1.0 契约的全部 20 种类型。每页包含完整 plain/secret 及嵌套字段、运行规则、配置、实际语言助手、失败恢复和清理。示例仅含合成值/服务桩，未执行，不代表已经测试。\n\n' : 'A resource is a folder-identified project configuration asset, not an endpoint. Creating one does not provision a remote service or automatically start a trigger. This reference covers all 20 kinds in the pinned 1.1.0 contract. Every page includes complete plain/secret and nested fields, runtime rules, configuration, actual language helpers, failure recovery and cleanup. Synthetic/stub examples were not executed and are not test claims.\n\n';
  index+=lang?'## 类型目录\n\n| wire kind | 用途与边界 |\n| --- | --- |\n':'## Kind inventory\n\n| Wire kind | Purpose and boundary |\n| --- | --- |\n';
  for(const r of contract.resources) index+=`| [\`${r.kind}\`](${r.kind}.md) | ${cell(resources[r.kind].intro[lang])} |\n`;
  index+='\n'+shared(lang);
  index+=lang ? '\n## 选择与操作边界\n\nSQL 与事务支持 postgresql/mysql/sqlserver/sqlite；数据库 viat_gql、graphql 助手和 CRUD 引擎仅 PostgreSQL/MySQL/SQLite。远程 graphql 是另一种 HTTP 上游资源。amqp 同时有脚本发布与单独配置的队列触发器消费；storage 是本地/S3 字节加项目 PostgreSQL 元数据；library 是冻结 Rust/binary 导出而非 Python import；cloud_api 仅两种签名协议。push 已有 JPush/FCM/APNs 及脚本 send，但未发布 APNs widget 加密快照不在 1.1.0 stable。\n\nPython/TypeScript 提供资源方法，Rust 以已验证通用 RPC 或特定助手调用，shell 只有 JSON 投影而无同名方法。不要从 schema 推断不存在的 CLI/MCP/SDK 能力。Test 可能真实出站、认证、创建 SQLite 文件或写本地 storage 探针；保存 audit/storage/library 更可能有 DDL/构建副作用，不能统一称 dry-run。\n\n## 1.1.0 秘密与传输限制\n\nHTTP/GraphQL/LLM/cloud/mail/storage/crypto/push 的凭据由平台操作应用，移除的 r.secret/r.auth_headers 不可恢复使用。secret.value 和 config 中解析的秘密则有意提供给脚本，两者必须区分。兼容投影仍会向 worker 暴露 postgresql/mysql/redis/mongodb/amqp 的带凭据 URL、sqlserver 的 ADO/账号秘密及 s3 key；即使只调用代理助手，整个依赖树也必须可信。不要提取/返回这些值，优先代理助手、最小账号权限。\n\nPostgreSQL 的 ssl 字段在 1.1.0 SQL/GraphQL 池及 Test 中未应用，不能据此声称强制 TLS；MySQL ssl:true 使用 Preferred，可能回退明文。严格传输要求需由部署/数据库约束并独立验证，成功 Test 不是严格 TLS 证明。RSA 解析实际接受至少 1024 位，生产新 key 建议至少 2048 位。\n\n## 管理入口\n\n[平台用户](../../instance/platform-users.md)与[项目协作](../../projects/create-and-collaborate.md)说明登录/角色前置条件。实际 CLI 包括 resource list/show/create --file/edit --file/test/refresh/delete/set-secret/set-field；edit 是完整 PUT，set-secret 从 stdin 读取单字段并 PATCH。仓库 push 对已有资源使用 PATCH；没有必要杜撰 resource apply 或 create --kind 等不存在的命令。\n' : '\n## Selection and operation boundaries\n\nSQL/transactions support postgresql/mysql/sqlserver/sqlite. Database viat_gql, graphql helpers and CRUD engines support only PostgreSQL/MySQL/SQLite. Remote graphql is a separate HTTP upstream. amqp has script publishing plus separately configured queue-trigger consumption. storage means local/S3 bytes plus project PostgreSQL metadata. library is frozen Rust/binary exports, not Python imports. cloud_api supports only two signing protocols. push has JPush/FCM/APNs and script send, but unreleased encrypted APNs widget snapshots are not stable 1.1.0.\n\nPython/TypeScript have resource methods, Rust uses verified generic RPC or specific helpers, shell has JSON projection without those methods. Never infer nonexistent CLI/MCP/SDK support from a schema. Test may perform real outbound/auth actions, create SQLite files or write a local-storage probe; saving audit/storage/library can perform DDL/builds. None is universally a dry-run.\n\n## 1.1.0 secret and transport limitations\n\nHTTP/GraphQL/LLM/cloud/mail/storage/crypto/push credentials are applied by platform operations; removed r.secret/r.auth_headers patterns are unsupported. secret.value and hydrated config secrets intentionally reach scripts and are a different boundary. Compatibility projection still exposes credential-bearing postgresql/mysql/redis/mongodb/amqp URLs, sqlserver ADO/account secrets and s3 keys to workers. Even when using broker helpers, trust the whole dependency tree. Never extract/return these values; prefer broker operations and minimal upstream privileges.\n\nPostgreSQL ssl is not applied by 1.1.0 SQL/GraphQL pools or Test, so it does not enforce TLS. MySQL ssl:true uses Preferred and can fall back to plaintext. Enforce strict transport in deployment/database policy and verify independently; a passing Test is not strict TLS proof. RSA parsing actually accepts at least 1024 bits; use at least 2048 for new production keys.\n\n## Management entry points\n\n[Platform users](../../instance/platform-users.md) and [project collaboration](../../projects/create-and-collaborate.md) explain authentication/roles. Actual CLI includes resource list/show/create --file/edit --file/test/refresh/delete/set-secret/set-field. edit is full PUT; set-secret reads one field from stdin and PATCHes. Repo push PATCHes existing resources. Do not invent resource apply or create --kind commands.\n';
  await writeFile(path.join(dir,'index.md'),await escapeGeneratedHtml(index));
}
console.log(`Authored ${contract.resources.length * 2} resource pages and 2 overviews; no examples executed.`);
