import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { notes, permission, pair, dummyId } from '../content/cli-notes.mjs';
import { escapeGeneratedHtml } from './lib/markdown.mjs';
import { argumentArity } from './lib/cli.mjs';

// Authoring only: no CLI execution, tests, builds, installs, HTTP or source-tree writes.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contract = JSON.parse(await readFile(path.join(root, 'contracts/1.1.0/cli.json'), 'utf8'));
const leaves = contract.commands.filter(c => c.leaf);
const keyOf = c => c.path.slice(1).join(' ');
const groupOf = c => ['push','pull','export','import'].includes(c.path[1]) ? 'sync' : ['version','call','mcp'].includes(c.path[1]) ? 'utilities' : c.path[1];
const groups = [...new Set(leaves.map(groupOf))].sort();
if (leaves.length !== 144 || contract.command_count !== 171) throw new Error('Pinned CLI inventory changed; review source and release before regenerating.');
for (const c of leaves) if (!notes[keyOf(c)]) throw new Error(`Missing behavioral notes: ${keyOf(c)}`);
for (const key of Object.keys(notes)) if (!leaves.some(c => keyOf(c) === key)) throw new Error(`Unknown CLI note: ${key}`);

// Option-specific permission exceptions are intentional, not inferred from verb names.
notes['auth token create'].behavior = notes['auth token create'].behavior.map((s,i) => s + (i ? ' 名称须 1–64 字节，且同账号内唯一；scoped 项目必须已有成员身份。' : ' Name must be 1–64 bytes and unique per account; project scoping requires membership in that project.'));
notes.call.perm = pair('Plain mode needs configured server and selected project; endpoint authorizers decide whether a project token is needed. Console mode needs platform login and the requested route’s own role.', '普通模式需服务端配置和所选项目；端点认证器决定是否需项目 token。控制台模式需平台登录及目标路由自身角色。');
notes.mcp.perm = pair('Configured server URL and platform JWT/PAT strings; no existing validated session or selected project required at startup. Every later tool enforces its own account/project role.', '配置 URL 和平台 JWT/PAT 字符串；启动不需已验证会话或所选项目。之后每个工具各自校验账号/项目角色。');
notes['endpoint test'].perm = pair('A selected project slug in the resolved CLI config and a local repo root are REQUIRED, but no usable platform session/server is needed; execution uses the scratch host and dedicated PostgreSQL base URL.', '配置中必须已选择项目 slug，并在本地仓库根运行；不需可用平台会话/服务端，执行使用临时 host 和专用 PostgreSQL 基础 URL。');
notes['endpoint test'].output = pair('Text: ok/FAIL per fixture then N passed, N failed. Any failed fixture exits 1. Missing directory or zero discovered YAML/YML fixtures is an error (not an empty green run). Host version is checked before dispatch; scratch publish explicitly acknowledges warnings and saved regression-case failures.', '文本逐夹具 ok/FAIL，再 N passed, N failed。任一失败退出 1。目录不存在或未发现任何 YAML/YML 夹具也是错误（不是空套件绿色通过）。dispatch 前核对 host 版本；临时 publish 显式确认警告和保存回归用例失败。');
notes['script test'].output = notes['script test'].output.map((s,i) => s + (i ? ' 完全未发现测试时明确退出 0（no tests found），与 endpoint test 的空夹具失败不同。' : ' When no tests at all are discovered it explicitly exits 0 (no tests found), unlike endpoint test which fails on an empty fixture set.'));
notes['script env'].behavior = notes['script env'].behavior.map((s,i) => s + (i ? ' 普通读取只需成员；--probe 会派生探测进程，额外要求项目 Owner/Admin/Developer。' : ' Plain reads require membership; --probe forks a probing process and additionally requires project Owner/Admin/Developer.'));
notes['script create'].behavior = notes['script create'].behavior.map((s,i) => s + (i ? ' 允许语言：python、typescript、sql、graphql、shell、llm、viat_gql、rust、binary。' : ' Accepted languages: python, typescript, sql, graphql, shell, llm, viat_gql, rust, binary.'));
notes['project create'].output = pair('stdout: created <slug>; 0 after successful response.', 'stdout: created <slug>；响应成功后退出 0。');
notes['workflow create'].prerequisite = pair('Write demo-workflow.yaml using the synthetic fixture in this page and create demo_echo first. No provider is used by that script.', '按本页合成夹具写 demo-workflow.yaml，并先创建 demo_echo。该脚本不使用提供方。');

const sources = {
  auth: ['commands/auth.rs','commands/auth_token.rs','../viat-api/src/handlers/auth_tokens.rs'],
  project: ['commands/project.rs','commands/diff.rs','repo/diff.rs','../viat-api/src/handlers/projects.rs'],
  resource: ['commands/resource.rs','repo/resources.rs','../viat-api/src/handlers/resources.rs'],
  script: ['commands/script.rs','../viat-api/src/handlers/scripts.rs','../viat-api/src/handlers/rust_artifact.rs'],
  workflow: ['commands/workflow.rs:150–216','../viat-api/src/handlers/workflows.rs'],
  schedule: ['commands/schedule.rs','../viat-api/src/handlers/schedules.rs'],
  testcase: ['commands/test_case.rs','../viat-api/src/handlers/test_cases.rs'],
  endpoint: ['commands/endpoint.rs','commands/endpoint_test.rs','../viat-api/src/handlers/endpoints.rs','../viat-api/src/handlers/snapshots.rs'],
  tree: ['commands/tree.rs','../viat-api/src/handlers/trees.rs','../viat-db/src/endpoint_trees.rs'],
  publish: ['commands/publish.rs','../viat-api/src/handlers/publish.rs','../viat-api/src/handlers/snapshots.rs'],
  authorizer: ['commands/authorizer.rs','../viat-api/src/handlers/authorizers.rs'],
  apikey: ['commands/apikey.rs','../viat-api/src/handlers/api_keys.rs'],
  role: ['commands/role.rs','../viat-api/src/handlers/roles.rs'],
  'p-user': ['commands/project_user.rs','../viat-api/src/handlers/project_users.rs'],
  user: ['main.rs:1246–1273,1502–1527','commands/user.rs','commands/role.rs','commands/authorizer.rs','../viat-api/src/handlers/users.rs'],
  license: ['commands/license.rs','../viat-api/src/handlers/license.rs'],
  logs: ['commands/logs.rs','../viat-api/src/handlers/logs.rs','../viat-db/src/logs.rs'],
  audit: ['commands/audit.rs','../viat-api/src/handlers/audit_trail.rs'],
  files: ['commands/files.rs','../viat-api/src/handlers/files.rs'],
  sync: ['commands/sync.rs','commands/bundle.rs','repo/{viat_yaml,resources,scripts,workflows,schedules,watches,queue_triggers,ws_triggers,im,endpoints,crate_files,model_guard,authz_steps}.rs'],
  db: ['commands/db.rs','../viat-api/src/handlers/db_migrations.rs','../viat-runtime/src/db_migrate.rs'],
  authz: ['commands/authz.rs','repo/model_guard.rs','../viat-api/src/handlers/authz_console.rs'],
  utilities: ['commands/auth.rs:277–324','commands/endpoint.rs:325–380','commands/mcp.rs','../viat-mcp/src/{config,http,lib}.rs']
};
const runtimeDefaults = {
  'auth token create:ttl': pair('30d; never → no expiry', '30d；never → 不过期'),
  'project init:name': pair('slug', 'slug'),
  'project init:server': pair('resolved config server_url', '配置中的 server_url'),
  'script run:args': pair('{}', '{}'),
  'script test:targets': pair('tests/; Rust discovery scripts/ when no explicit targets', 'tests/；无显式目标时 Rust 发现 scripts/'),
  'script compile:sdk_path': pair('VIAT_RUST_SDK_PATH, otherwise error', 'VIAT_RUST_SDK_PATH，否则报错'),
  'script upload:target': pair('CLI machine OS/architecture', 'CLI 机器 OS/架构'),
  'endpoint test:dir': pair('endpoint_tests/', 'endpoint_tests/'),
  'export:slug': pair('current_project', 'current_project'),
  'export:output': pair('./<slug>.viatpkg', './<slug>.viatpkg'),
  'db status:resource': pair('all discovered migration directories', '所有发现迁移目录'),
  'db migrate:resource': pair('all discovered migration directories', '所有发现迁移目录'),
  'files list:limit': pair('server 100, clamped 1–1000', '服务端 100，限 1–1000'),
  'files get:out': pair('sanitized stored name, fallback file', '清理后的已存名称，回退 file'),
  'files put:name': pair('local file basename', '本地文件 basename'),
  'files put:key': pair('<new UUID>/<name>', '<新 UUID>/<name>'),
  'files put:content_type': pair('server guesses from stored name', '服务端按已存名称推断'),
  'audit query:limit': pair('server 100, clamped by configured maximum', '服务端 100，受配置上限约束'),
  'logs query:limit': pair('server 50, clamped 1–200', '服务端 50，限 1–200'),
  'logs search:limit': pair('server 50, clamped 1–200', '服务端 50，限 1–200')
};
const j = JSON.stringify;
const cell = s => String(s ?? '').replaceAll('|','&#124;').replaceAll('\n',' ');
const code = s => '`'+cell(s)+'`';
const shell = argv => argv.map(s => /^[A-Za-z0-9_./:@=,+-]+$/.test(s) ? s : "'"+s.replaceAll("'", "'\\''")+"'").join(' ');
const translated = (v,l) => Array.isArray(v) ? v[l] : v;
function frontmatter(title, description, id, commands=[]) {
  return `---\ntitle: ${j(title)}\ndescription: ${j(description)}\ndoc_id: ${id}\nverified_release: '1.1.0'\nchannel: stable\ncontract_ids: ${j(commands.map(c=>'cli.'+c.path.slice(1).join('.')))}\n---\n\n`;
}
function grammar(c,l) {
  const aliases = [...new Set([...c.aliases,...c.visible_aliases])];
  const usage = (c.long_help ?? c.help).split('\n').find(s => s.startsWith('Usage:'));
  let s = `\n\`\`\`text\n${usage ?? c.path.join(' ')}\n\`\`\`\n\n`;
  s += (l ? '**命令别名：** ' : '**Command aliases:** ') + (aliases.length ? aliases.map(a=>code([...c.path.slice(0,-1),a].join(' '))).join(', ') : (l?'无。':'none.'))+'\n\n';
  s += l ? '| 参数 ID / 完整拼写 | 类型、消费值数量、action | 必填 / 默认 | 允许值 | 冲突、别名、解析与原始 Clap 帮助 |\n| --- | --- | --- | --- | --- |\n' : '| Argument ID / all spellings | Type, value count, action | Required / default | Allowed values | Conflicts, aliases, parsing and original Clap help |\n| --- | --- | --- | --- | --- |\n';
  for(const a of c.arguments) {
    const names = [a.long && '--'+a.long, a.short && '-'+a.short, ...[...a.aliases,...a.visible_aliases].map(x=>'--'+x), ...[...a.short_aliases,...a.visible_short_aliases].map(x=>'-'+x)].filter(Boolean);
    if(a.index) names.unshift(`<${a.value_names.join(' ') || a.id}> (#${a.index})`);
    const cardinality = argumentArity(a.num_args);
    const rd = runtimeDefaults[`${keyOf(c)}:${a.id}`]?.[l] ?? a.runtime_default;
    let def = a.default_values.length ? a.default_values.map(v=>code(v)).join(', ') : (l?'Clap 无显式默认':'no explicit Clap default');
    if(rd != null) def += (l?'；运行时：':' ; runtime: ')+code(typeof rd==='object'?j(rd):rd);
    const clauses = [];
    if(a.conflicts.length) clauses.push((l?'冲突 ID：':'conflict IDs: ')+a.conflicts.join(', '));
    if(a.env) clauses.push('env='+a.env);
    if(a.value_delimiter) clauses.push((l?'值分隔符：':'value delimiter: ')+j(a.value_delimiter));
    if(a.require_equals) clauses.push(l?'必须 --flag=value':'requires --flag=value');
    if(a.allow_hyphen_values) clauses.push(l?'允许连字符开头值':'allows hyphen-leading values');
    if(a.global) clauses.push(l?'向子命令传播':'propagates to subcommands');
    if(a.hidden) clauses.push(l?'隐藏参数':'hidden');
    if(a.long_help || a.help) clauses.push((l?'原始帮助：':'help: ')+(a.long_help || a.help));
    s += `| ${code(a.id)}: ${[...new Set(names)].map(code).join(' / ')} | ${code(a.value_type)}, ${cardinality}, ${code(a.action)} | ${a.required?(l?'是':'yes'):(l?'否；条件必填见行为':'no; conditional requirements below')}; ${cell(def)} | ${a.possible_values.length?a.possible_values.map(v=>code(typeof v==='string'?v:j(v))).join(' / '):'—'} | ${cell(clauses.join('; ')) || '—'} |\n`;
  }
  const meaningfulGroups = c.groups.filter(g=>g.arguments.length);
  if(meaningfulGroups.length) s += '\n'+(l?'Clap 参数组（literal metadata）：':'Clap argument groups (literal metadata): ') + meaningfulGroups.map(g=>code(j(g))).join('; ')+'\n';
  return s;
}
function section(c,l) {
  const n=notes[keyOf(c)];
  const perm=typeof n.perm==='string'?permission[n.perm]:n.perm;
  if(!perm || n.argv[0]!=='viat') throw new Error('Incomplete note '+keyOf(c));
  let s=`\n## ${c.path.join(' ')}\n\n`;
  s+=(l?'**前提与权限。** ':'**Prerequisites and permissions.** ')+perm[l]+' '+n.prerequisite[l]+'\n';
  s+=grammar(c,l);
  s+='\n'+(l?'**输入、行为与副作用。** ':'**Inputs, behavior and side effects.** ')+n.behavior[l]+'\n\n';
  s+=(l?'**实际输出与退出。** ':'**Actual output and exit.** ')+n.output[l]+' '+(l?'除本节例外外，正常完成为 0，参数/文件/HTTP/运行错误为非零（解析错误通常 2，运行错误通常 1）。':'Unless this section states otherwise, normal completion is 0; argument/file/HTTP/runtime errors are nonzero (typically 2 for parsing, 1 for runtime errors).')+'\n\n';
  s+=(l?'**合成调用示例（只校验语法，不执行）。**':'**Synthetic invocation (syntax validation only; not executed).**')+'\n\n```sh\n'+shell(n.argv)+'\n```\n\n';
  s+=(l?'**失败处理、验证与清理。** ':'**Failure handling, verification and cleanup.** ')+n.recovery[l]+'\n';
  return s;
}
function fixture(group,l) {
  if(!['script','workflow','resource','p-user','files','db','sync'].includes(group)) return '';
  let s='\n'+(l?'## 合成夹具与执行边界':'## Synthetic fixtures and execution boundary')+'\n\n';
  s+=(l?'这些文件只为下面例子提供输入；创建远程对象、执行脚本、数据库 SQL 或存储操作前，必须自行准备隔离项目并明确授权。生成文档不执行任何例子。':'These files supply inputs for the examples. Provision an isolated project and explicitly authorize remote creation, script execution, SQL or storage effects before running any command. Documentation generation executes none of them.')+'\n\n';
  if(group==='script') s+='```python\n# demo.py (also scripts/demo_echo.py in a repo checkout)\ndef main():\n    return {"ok": True}\n```\n\n'+(l?'先用 script create 创建 demo_echo，再运行 show/update/run 等例子。Rust/binary 示例还须你自己的匹配 SDK/可执行程序，并非此 Python 夹具；不能用文本文件冒充二进制。离线测试须另外编写真正断言的 tests/ 夹具，空套件不等于成功覆盖。':'Create demo_echo with script create before show/update/run examples. Rust/binary examples additionally require your own matching SDK/executable, not this Python fixture; do not upload text as an executable. Offline tests need actual assertions under tests/; an empty suite is not coverage.')+'\n';
  if(group==='workflow') s+='```yaml\n# demo-workflow.yaml\ninputs: {}\nsteps:\n  - id: echo\n    script: demo_echo\noutputs:\n  result: "$echo.output"\n```\n\n'+(l?'demo_echo 使用脚本页无资源的 Python 夹具。先创建脚本，再 workflow create，然后才可 test；编辑/测试的是草稿，不是已发布快照。':'demo_echo uses the resource-free Python fixture on the script page. Create the script first, then workflow create before test. Editing/testing addresses drafts, not published snapshots.')+'\n';
  if(group==='resource') s+='```json\n{"name":"demo_config","kind":"config","plain":{"data":{"enabled":true}},"secret":{}}\n```\n\n'+(l?'保存为 demo-resource.yaml（JSON 是有效 YAML）。set-secret 例需另建 secret 类型 demo_secret：{"name":"demo_secret","kind":"secret","plain":{},"secret":{"value":"demo-only"}}。demo_db 是你自己配置的隔离数据库，不随示例创建。':'Save as demo-resource.yaml (JSON is valid YAML). The set-secret example needs a separate secret-kind demo_secret: {"name":"demo_secret","kind":"secret","plain":{},"secret":{"value":"demo-only"}}. demo_db is your own provisioned isolated database; these examples do not create it.')+'\n';
  if(group==='p-user') s+='```json\n[{"identity":"demo_import_user","display_name":"Imported Demo"}]\n```\n\n'+(l?'保存为 demo-users.json。demo_role 先通过 role create --name demo_role 创建；demo_user 是独立演示终端用户，不是平台登录邮箱。无密码行仅用于迁移形状，设置凭据后才能密码登录。':'Save as demo-users.json. Create demo_role with role create --name demo_role first. demo_user is a separate demo end user, not a platform-login email. The passwordless row illustrates migration shape; set credentials before password login.')+'\n';
  if(group==='files') s+=(l?'demo.txt 只含合成文本。demo_storage 必须已配置受管文件存储、元数据 PostgreSQL 和 local/S3 字节后端；CLI 不会为你开通存储/桶/数据库。文件 UUID 用 files list/put 实际返回值替换。':'demo.txt contains synthetic text only. demo_storage must already have managed storage, metadata PostgreSQL and local/S3 bytes configured; the CLI does not provision storage/buckets/databases for you. Replace file UUIDs with actual files list/put values.')+'\n';
  if(group==='db') s+='```sql\n-- migrations/demo_db/0001_demo.sql; isolated PostgreSQL/MySQL/SQLite only\nCREATE TABLE cli_demo (id INTEGER PRIMARY KEY);\n```\n\n'+(l?'先配置可写隔离 demo_db 资源并备份。baseline 仅在该表已按文件精确存在时使用；repair 仅在确有已手工修复的失败行时使用，不把这四命令当作顺序执行教程。清理表需你审核并授权的新迁移；本页不执行 SQL。':'Provision and back up a writable isolated demo_db resource first. Baseline is only for a schema already exactly matching the file; repair is only for an actually failed row you have manually repaired. These four commands are not a sequence to execute blindly. Dropping the demo table requires a separately reviewed and authorized new migration; this page executes no SQL.')+'\n';
  if(group==='sync') s+=(l?'仓库布局：viat.yaml；scripts/<folder>/<name>.<ext>；workflows/resources/schedules/watches/queue_triggers/ws_triggers 下的 YAML；im/accounts 与 im/triggers；endpoints/<tree>/ 的节点文件；crate/；migrations/<resource>/*.sql 与 authz/migrations/*.yaml（后两者不是同一套迁移）。文件夹是资产身份的一部分。':'Repo layout: viat.yaml; scripts/<folder>/<name>.<ext>; YAML under workflows/resources/schedules/watches/queue_triggers/ws_triggers; im/accounts and im/triggers; endpoint node files under endpoints/<tree>/; crate/; migrations/<resource>/*.sql and authz/migrations/*.yaml (different migration systems). Folders are part of asset identity.')+'\n\n'+(l?'资源 secret 的字符串 $secret 是“不导出秘密”的占位，push 会去掉，不能创建凭据；{$secret: name} / "$secret:name" 是支持位置的资源引用，不是同一东西。顶层 plain 的 $keep 只保留服务端已有值，新资源不能用；不是深合并。':'A resource secret’s string $secret is an export placeholder stripped by push, not a credential; {$secret: name} / "$secret:name" are resource references in supported positions, not the same construct. Top-level plain $keep preserves an existing server value only; it is not deep merge and cannot initialize a new resource.')+'\n\n'+(l?'同步不会维护所有客户端面：项目设置、秘密、扫码聊天绑定等有明确边界。聊天仅能同步以资源持有凭据的账号；行秘密/扫码账号不会 pull 也不会因缺文件被 push 删除。publish 不等于 push，SQL 迁移也不会自动执行。':'Sync does not cover every console setting, credential or scanned chat binding. Only resource-credential chat accounts are syncable; row-secret/QR accounts are neither pulled nor deleted by push due to absence. Publish is separate from push, and SQL migrations are not run automatically.')+'\n';
  return s;
}
function overview(l) {
  const title=l?'CLI 完整参考':'Complete CLI reference';
  let s=frontmatter(title,l?'Viat 1.1.0 CLI 的 144 个命令、语法、权限、输出、副作用与恢复索引。':'All 144 Viat 1.1.0 CLI commands: grammar, permissions, outputs, effects and recovery.','cli.overview');
  s+=`# ${title}\n\n`;
  s+=l?'此参考对应稳定服务端/CLI 1.1.0：固定 Clap 合同共有 171 个节点、144 个叶命令。结构来自 contracts/1.1.0/cli.json，行为核对实际 CLI、仓库同步与 API 权限实现（功能源码 03751a67，版本发布提交 fd340879），不是从预览分支或历史计划推测。CLI 版本与桌面/移动客户端营销版本独立。\n':'This reference targets stable server/CLI 1.1.0: the pinned Clap contract has 171 nodes and 144 leaf commands. Structure comes from contracts/1.1.0/cli.json; behavior was checked against CLI, repo-sync and API permission implementations (feature source 03751a67, release version commit fd340879), not preview branches or archived plans. CLI and desktop/mobile marketing versions are independent.\n';
  s+='\n'+(l?'## 命令分组':'## Command groups')+'\n\n';
  for(const g of groups) s+=`- [viat ${g==='sync'?'push / pull / export / import':g==='utilities'?'version / call / mcp':g}](${g}.md) — ${leaves.filter(c=>groupOf(c)===g).length} ${l?'个叶命令':'leaf commands'}\n`;
  s+='\n'+(l?'## 安装、版本与本地前提':'## Installation, version and local prerequisites')+'\n\n';
  s+=l?'使用已发布 1.1.0 viat 二进制并放在 PATH。macOS 正式应用附带的 viat、viat-test-host、viat-endpoint-test-host 位于 Viat.app/Contents/MacOS；应用安装后的 Resources/install-cli.sh 可安装同级链接（本参考不执行安装）。本地测试 host 必须与 CLI 完全同版本，uv/bun/cargo 等语言工具不会由 CLI 自动提供。先 viat --version（本地）、需要服务端比较时用 viat version；不要把 --version 成功当成登录/服务端就绪。\n':'Use the released 1.1.0 viat binary on PATH. The official macOS app bundles viat, viat-test-host and viat-endpoint-test-host in Viat.app/Contents/MacOS; after installing the app, Resources/install-cli.sh can install sibling links (this reference performs no installation). Local test hosts must match the exact CLI version; language tools such as uv/bun/cargo are not automatically supplied by the CLI. Start with viat --version (local); use viat version for server comparison. --version success does not prove login/server readiness.\n';
  s+='\n'+(l?'## 会话、目录与网络约定':'## Session, directory and network conventions')+'\n\n';
  s+=l?'会话查找顺序：VIAT_CONFIG_DIR（指向配置目录本身）→ 从 CWD 向上找实际含 config.yaml 的 .viat → CWD/.viat。文件为 config.yaml，键有 server_url、access_token、refresh_token、refresh_expires_at、current_project、project_token，以及兼容旧 token。access_token 优先于旧 token。配置含凭据，须限制访问，不提交仓库。登录/刷新会写回配置；普通控制面请求遇 401 可刷新一次、重试一次，并持久化轮换 token。无可用刷新时重新 auth login。\n\n此目录发现不改变 CWD：push/pull/project diff/db 等仍以当前目录为仓库根。没有全局 --server 或 --json；只使用各叶声明的参数。-h/--help 与根 -V/--version 正常打印即退出 0；无效语法通常退出 2，尚未发 API。参数表的“无显式默认”是 Clap 结构事实，不否认下述运行时/API 默认。\n\n普通 CLI 使用环境 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY；访问本地实例可设 NO_PROXY=localhost,127.0.0.1，或 VIAT_NO_PROXY=1 绕过所有代理。普通 viat call 与 MCP 永远绕过代理，call --console 则走普通可刷新客户端并遵守代理。\n':'Session lookup: VIAT_CONFIG_DIR (the config directory itself) → upward search from CWD for a .viat actually containing config.yaml → CWD/.viat. config.yaml contains server_url, access_token, refresh_token, refresh_expires_at, current_project, project_token and legacy token. access_token takes precedence over token. Protect this credential-bearing file and never commit it. Login/refresh writes configuration; ordinary control-plane requests can refresh once on 401, retry once, and persist rotated tokens. Re-login when refresh is unavailable.\n\nSession discovery does not change CWD: push/pull/project diff/db still use the current directory as repo root. There is no global --server or --json; use only flags declared on each leaf. -h/--help and root -V/--version print and exit 0; invalid syntax usually exits 2 before API work. “No explicit default” in the table describes Clap, not the absence of the runtime/API defaults explained below.\n\nOrdinary CLI HTTP honors HTTP_PROXY/HTTPS_PROXY/ALL_PROXY; for localhost use NO_PROXY=localhost,127.0.0.1 or VIAT_NO_PROXY=1 to bypass every proxy. Plain viat call and MCP always bypass proxies; call --console instead uses the ordinary refreshing client and proxy settings.\n';
  s+='\n'+(l?'## 身份、权限与结果边界':'## Identity, permission and result boundaries')+'\n\n';
  s+=l?'平台账号的角色不等于其项目成员角色，也不等于项目 p-user/role。有效项目角色为 owner/admin/developer/operator：editor 为前三个，publisher 仅前两个。此参考逐命令标出例外：role/authorizer/apikey/p-user/tree/endpoint 读取也需 editor，schedule 写只需成员，project publish history 读取只需成员而 endpoint history 需 publisher。API 原有检查才是权限，不能从动词推测。\n\n控制面一般使用平台登录/PAT（auth token 管理及平台 MFA 重置只接受会话）；运行时 call 使用另存的 project_token，登录不会自动创建它。未激活部署可返回 403 license_required；换项目/角色不能激活。auth 与 license 相关入口保留可用，但启动 MCP/列工具并不证明其远程调用可用。\n\n正常完成退出 0；运行/文件/HTTP 错误通常 1；本页各叶明确列出差异、成功空结果、持续流以及测试的非零条件。API 非 2xx 常呈 HTTP <status>: <body>，license_required/rate_limited/forbidden 有定向说明。输出不是统一结构：--json 仅在声明处有效，resource set-field --json 是输入解析，push/pull --json 仍可夹阶段文本，call 输出状态+body，apikey create 输出一次性秘密。不要把文本“FAILED”、output:null 或启动成功自动等同某种退出码/HTTP 结果。\n':'A platform account’s role is not its project membership role, nor a project p-user/role. Effective project roles are owner/admin/developer/operator: editor means the first three; publisher means only the first two. Exceptions are documented per command: role/authorizer/apikey/p-user/tree/endpoint reads require editor; schedule writes need membership; project publish history needs membership whereas endpoint history needs publisher. Permissions come from actual API guards, not verb names.\n\nControl-plane requests normally use platform login/PAT (auth token management and platform MFA reset require a login session); runtime call uses separately stored project_token, which login does not mint automatically. Unactivated deployments can return 403 license_required; switching project/role does not activate them. Auth/license entry points remain available, but MCP startup/tool listing does not prove its remote calls are usable.\n\nNormal completion exits 0; runtime/file/HTTP failures usually 1. Each leaf below states diff, empty-success, streaming and test-result exceptions. API non-2xx commonly appears as HTTP <status>: <body>, with directed remedies for license_required/rate_limited/forbidden. Output is not uniform: --json exists only where declared; resource set-field --json parses input; push/pull --json may mix stage text; call prints status+body; apikey create prints a one-time secret. Do not automatically map text “FAILED”, output:null or startup success to a particular exit code/HTTP outcome.\n';
  s+='\n'+(l?'## 合成示例的准备与清理':'## Preparing and cleaning up synthetic examples')+'\n\n';
  s+=l?'以下为隔离实例的语法示例，不会被文档脚本执行。账号、密码和邮箱均为合成值，不是产品默认凭据；你必须已有授权平台账号。只有主动同意远程变更后，才把地址/账号换为自己的隔离实例并执行。\n':'These are syntax examples for an isolated instance; documentation scripts do not execute them. Account/password/email values are synthetic, not shipped credentials; you must have an authorized platform account. Substitute your isolated instance/account and run only after explicitly opting into remote mutations.\n';
  s+='\n```sh\nviat auth login --server http://127.0.0.1:28080 --email operator@example.invalid --password demo-only-not-a-real-password\nviat project create cli-demo "CLI Demo"\nviat project select cli-demo\nviat project list --json\n```\n\n';
  s+=l?`创建后对象 ID 由服务端返回。示例 UUID ${dummyId} 只是语法有效的合成占位；运行 show/delete/revoke 等前，必须用同项目 list/create 返回的真实演示 UUID 替换。不要把 request_id、execution_log_id、endpoint ID、snapshot ID、revision ID、file ID 和 API key 的短 key_id 混用。每组页补充本地文件和远程对象前提；license activate 不可能用伪 code 成功，必须取得官方有效 code。\n\n例子 argv 的单一来源为 examples/cli-argv.json（token 数组的数组、argv[0]=viat），与页面由同一数据生成。它只供语法验证，不是可循环执行的脚本：例如 delete/rollback/trigger/baseline 不能按清单顺序跑。读/写/执行/发布分开授权，真实提供方、付费调用、发送消息、设备动作和活库清理必须另行明确同意。\n\n各节给出验证与清理。保留修改前源码/config/数据库备份；远程多阶段命令通常不是全局事务。1.1.0 没有 project delete CLI，管理路由也没有项目 DELETE；不要编造控制台/API 删除入口。只能按已有入口清理所创建资产、触发器与成员，留下空项目；外部数据库、桶、文件和已发消息仍需分别处理。删除本地生成的夹具/导出文件前先核对路径，并单独撤销演示令牌。\n`:`Object IDs come from the server. Example UUID ${dummyId} is a syntactically valid synthetic placeholder; replace it with the actual demo UUID from that project’s list/create response before show/delete/revoke. Do not mix request_id, execution_log_id, endpoint ID, snapshot ID, revision ID, file ID or the API key’s short key_id. Group pages supply local-file and remote-object prerequisites. license activate cannot succeed with a fake code: obtain an official valid customer code.\n\nThe single argv source is examples/cli-argv.json (array of token arrays, argv[0]=viat), generated from the same data as the pages. It is for syntax validation only, not an execution loop: delete/rollback/trigger/baseline must not be run in manifest order. Authorize reads, writes, execution and publish separately; real providers, paid calls, message sends, device actions and live cleanup require separate explicit opt-in.\n\nEach section explains verification and cleanup. Keep previous source/config/database backups; remote multi-stage commands are generally not globally transactional. In 1.1.0 there is no project delete CLI or management DELETE route; do not invent a console/API removal entry point. Clean up owned assets, triggers and memberships through supported operations, leaving the empty project. External DBs, buckets, files and sent messages need separate handling. Check paths before deleting generated local fixtures/exports and revoke demo tokens separately.\n`;
  s+='\n'+(l?'## 不支持或不是本版本命令':'## Unsupported or nonexistent command spellings')+'\n\n';
  s+=l?'没有 project push、tokens create、push --prune、全局 --json、旧 endpoint --permissions。使用 viat push、viat auth token create；只有 import 有 --prune。CLI/MCP 不刻意镜像全部控制台设置或 API，不能从某个 schema 推出存在某个命令。\n':'There is no project push, tokens create, push --prune, global --json or retired endpoint --permissions. Use viat push and viat auth token create; --prune belongs to import only. CLI/MCP intentionally do not mirror all console settings/APIs; a schema does not imply a command exists.\n';
  s+='\n'+(l?'## 维护证据':'## Maintenance evidence')+'\n\n';
  s+=(l?'固定语法：':'Pinned grammar: ')+code('contracts/1.1.0/cli.json')+'; '+code('crates/viat-cli/src/main.rs')+'. '+(l?'通用客户端/配置：':'Common client/config: ')+code('crates/viat-cli/src/{client,config,pathref}.rs')+'. '+(l?'权限定义：':'Role definitions: ')+code('crates/viat-core/src/types/project.rs:5–24')+'. '+(l?'行为来源各组列出；源文件路径是维护证据，不替代本参考步骤。':'Group pages list behavioral evidence; source paths are maintenance evidence, not a substitute for the instructions above.')+'\n';
  return s;
}
for(const [l,locale] of ['en','zh-cn'].entries()) {
  const dir=path.join(root,'src/content/docs',locale,'cli');
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'overview.md'),await escapeGeneratedHtml(overview(l)));
  for(const group of groups) {
    const commands=leaves.filter(c=>groupOf(c)===group);
    const label=group==='sync'?'push / pull / export / import':group==='utilities'?'version / call / mcp':group;
    const title=l?`CLI：${label}`:`CLI: ${label}`;
    let s=frontmatter(title,l?`Viat 1.1.0 ${label} 的完整语法、逐命令权限、输出、副作用与恢复。`:`Complete Viat 1.1.0 ${label} grammar, per-command permissions, outputs, effects and recovery.`,`cli.${group}`,commands);
    s+=`# ${title}\n\n`+(l?'先读 [CLI 总览](overview.md)：会话/目录、退出约定、角色边界、合成占位 ID 和执行授权规则在其中统一定义。本页逐叶补充例外；以下命令不是按顺序执行的脚本。':'Read the [CLI overview](overview.md) for session/CWD resolution, exit conventions, role boundaries, synthetic IDs and execution authorization. This page documents leaf-specific exceptions; the commands are not a script to run in order.')+'\n\n';
    for(const c of commands) s+=`- [${c.path.join(' ')}](#${c.path.join('-')})\n`;
    s+=fixture(group,l);
    for(const c of commands) s+=section(c,l);
    s+='\n'+(l?'## 实现核对依据':'## Implementation evidence')+'\n\n';
    s+=(l?'语法来自固定 Clap 合同与 main.rs；行为/权限核对以下源文件，路径相对产品仓库根。':'Grammar comes from the pinned Clap contract and main.rs; behavior/permissions were checked against these files. Paths are relative to the product repository root.')+'\n\n';
    for(const src of sources[group] ?? []) s+='- '+code(src.startsWith('../') ? 'crates/'+src.slice(3) : 'crates/viat-cli/src/'+src)+'\n';
    await writeFile(path.join(dir,group+'.md'),await escapeGeneratedHtml(s));
  }
}
await mkdir(path.join(root,'examples'),{recursive:true});
await writeFile(path.join(root,'examples/cli-argv.json'),j(leaves.map(c=>notes[keyOf(c)].argv),null,2)+'\n');
console.log(`Authored ${(groups.length+1)*2} Markdown files and ${leaves.length} argv arrays; no examples executed.`);
