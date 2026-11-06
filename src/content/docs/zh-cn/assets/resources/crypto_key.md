---
title: "加密密钥资源"
description: "对平台持有的 aes/hmac/rsa/ecdsa_p256/ed25519/sm2/sm4 密钥执行操作。algorithm 选密钥类型，协议模式由调用参数决定。私密材料不进脚本，不是 CA、密钥发行方或通用 HSM。"
doc_id: resource.crypto_key
verified_release: '1.1.0'
channel: stable
contract_ids: [resource.crypto_key]
---

# 加密密钥资源

对平台持有的 aes/hmac/rsa/ecdsa_p256/ed25519/sm2/sm4 密钥执行操作。algorithm 选密钥类型，协议模式由调用参数决定。私密材料不进脚本，不是 CA、密钥发行方或通用 HSM。

本页核对 Viat 1.1.0 稳定版。示例使用合成值/服务桩，未执行、未连接真实服务、未发送消息。先读[资源总览](index.md)。

## 前置条件与权限

通过自己的密钥管理流程准备获授权材料并匹配合作方协议。保存解析真实材料，伪 PEM 占位符不能通过。示例为无害 HMAC 测试值，不是厂商签名 key。

## 完整配置字段

表中“必填”描述结构解析；提供方/后端的条件必填、运行时默认及限制在下节补充。`null` 仅在类型明确允许时可用，数字格式的存储上限不等于有意义的业务范围。不要依赖未知键被忽略来检测拼写。

### `plain`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `plain.algorithm` | CryptoAlgorithm | 是 | — | — | 密钥类型，操作模式是单独调用参数。 |
| `plain.key_encoding` | KeyEncoding | 否；可能条件必填 | `"auto"` | — | 非 PEM key 解码方式，auto 按算法决定。 |
| `plain.key_id` | string / null | 否；可能条件必填 | `null` | — | crypto 信封/JWT key 标签，push 中为 APNs 签名 key 标识。 |
| `plain.public_key` | string / null | 否；可能条件必填 | `null` | — | 可导出非对称公钥，仅提供私钥时可推导。 |

#### `CryptoAlgorithm`

允许结构/值：`"aes" / "hmac" / "rsa" / "ecdsa_p256" / "ed25519" / "sm2" / "sm4"`。

#### `KeyEncoding`

允许结构/值：`"auto" / "base64" / "hex" / "utf8"`。

### `secret`

| 字段 | 类型/允许值 | 必填 | 省略默认 | 约束 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `secret.key` | string | 否；可能条件必填 | `""` | — | aes/hmac/sm4 对称 key，按 key_encoding 编码。 |
| `secret.previous_key` | string | 否；可能条件必填 | `""` | — | 仅 AES 封装 token/HMAC 验证的轮换槽。 |
| `secret.private_key` | string | 否；可能条件必填 | `""` | — | 非对称私钥材料，省略时仅可用受支持公钥操作。 |

## 运行规则、默认值与限制

algorithm 必填，key_encoding 默认 auto：hmac→utf8、aes/sm4→base64、原始非对称→hex，PEM BEGIN 头始终识别。aes/hmac/sm4 用 secret.key：AES 解码长度 16/24/32 字节，SM4 16，HMAC 非空。非对称用 private_key 或 public_key，仅公钥在支持时可验签/加密、不可签名/解密。RSA 解析器接受至少 1024 位（新生产密钥应至少 2048 位，旧 schema 注释所称强制 2048 位下限不准确），ECDSA 为 P-256，Ed25519/SM2 材料须匹配。保存裁剪字符串并解析兼容性。key_id 覆盖默认 SHA-256 前八位十六进制。

previous_key 仅用于轮换期间 AES 封装信封解密、HMAC 验证，不会给原始 AES 模式自动选 key，SM4 拒绝该字段。对称资源不能携带无关非对称材料。退役前规划密文/签名兼容。PEM 私钥使用对应算法接受的 PKCS#8/PKCS#1/SEC1 编码，SM2 原始标量/点可用 hex。

每次密码操作解码输入上限 1 MiB，key_id 不可含点或空白。cipher 的 data/encoding/output 为字符串及 utf8/base64/hex，encrypt 输入默认 utf8、decrypt 默认 base64。AES 原始 gcm/cbc/ecb 返回密文/IV 数据，解密须匹配 iv/aad（及 iv_encoding/aad_encoding，AAD 默认 utf8）。RSA cipher hash 为 sha256（默认）或 sha1，mgf1_hash 可不同；padding 为 oaep（默认）或 pkcs1v15，chunked 默认 false。SM2 layout 为 c1c3c2（默认）、c1c2c3、asn1。签名 hash 默认 sha256（RSA/HMAC），RSA 还支持 sha1/sha384/sha512 和旧 md5，HMAC 不支持 md5。RSA 签名 padding 为 pkcs1v15（默认）或 pss。ECDSA/SM2 签名 format 为 der（默认）或 raw，验签省略时按 64 字节识别 raw。SM2 uid 默认 1234567812345678。新设计不要选择 MD5/SHA-1/ECB。

JWT：jwt_sign(claims,algorithm=None,headers=None,expires_in=None)/jwtSign(claims,opts) 按受支持 key 默认 HS256/RS256/ES256/EdDSA，expires_in 添加 exp 和缺失 iat，alg/kid 由平台设置。jwt_verify(token,algorithm=None,audience=None,issuer=None,leeway=None)/jwtVerify(token,opts) 返回 {claims,header}，有 exp 才检查到期，仅提供 audience/issuer 才检查，leeway 默认 60 秒。应显式设置预期 audience/issuer，并在应用契约要求到期字段。export_public_key 返回 {public_key,algorithm,key_id}，默认 PEM，按类型支持 RSA pkcs1 或 EC/Ed/SM2 hex/base64。generate_data_key(bytes=32) 接受 16/24/32，返回 {plaintext_key,wrapped_key}。

## 权限、身份与保存语义

管理 API 需要平台登录及项目成员身份。列举/查看需要成员身份；创建、PUT、PATCH、Test、refresh、copy、delete 需要有效项目角色 Owner/Admin/Developer；较低权限的 operator 角色不可写。管理权限不自动赋予上游账号权限，也不替代运行时的 s3/file/行级授权。MCP 只开放其工具清单实际声明的能力，不能把资源 schema 当作完整 MCP CRUD。

- 创建：`POST /projects/{slug}/resources`，请求为 `{name,folder?,kind,plain,secret}`。name 长度 1–64 字节且不可含 /；system 为保留名。folder 省略/空字符串表示根，非空为 [A-Za-z0-9_-]+ 段，最多 8 层/255 字节，无首尾或连续 /。
- 资源身份为同项目 `(folder,name)`，不是全项目裸名。同名可以位于不同文件夹。详情路由用 `/resources/{name}?folder=team` 显式定位；CLI 用 `team/name`。脚本裸引用按自身文件夹、根、全项目唯一名顺序解析，建议跨文件夹显式限定，Python 用 `getattr(ctx.resources, "team/name")`，TypeScript 用 `ctx.resources["team/name"]`，而非属性链。
- PUT 是完整替换：须重发正确 kind、完整 plain 与全部要保留的秘密值，不能从 show 的掩码恢复秘密。PATCH 的 kind 固定；省略 plain 保留，提供 plain 则整体替换（不是深合并）；secret 仅逐字段覆盖，省略字段保留。移动 folder 时引用在新位置重检。
- 清除可选秘密用 PATCH 显式 null（仅允许 null 的字段）或空字符串（仅允许空值的字段）；必需/条件必需字段不能清空。清除可选 plain 字段需发送去掉该字段的完整 plain，让类型默认/缺省生效。不要用 null 代替所有类型，也不要把 *** 当作旧值。
- `$keep` 是仅 PATCH/仓库同步使用的**顶层 plain 字段**占位符，保留服务端已有同名字段，连数字/布尔也可保留；新资源/不存在字段不能使用。嵌套 `$keep` 不是深合并指令。
- 仓库文件 `resources/<folder>/<name>.yaml` 由路径承载 folder，name 仍是裸名。`viat pull` 将 secret 字段写为字符串 `$secret`；`viat push` 去掉这些占位（也接受旧 !secret 标签），对已有资源 PATCH，绝不把占位当凭据。新资源必须先安全提供实际必需秘密；占位不能创建凭据。顶层 allowed_authorizers 是仓库访问同步元数据，不要擅自塞进 plain。

`$secret` 占位与凭据引用不同：`{"$secret":"name"}` 在 config/cloud 支持位置命名另一个 secret 资源；HTTP/GraphQL 字符串头用整个 `"$secret:name"`。它们不等于秘密明文，保存/读取/导出保留引用，使用时解析。目标按消费资源文件夹锚定并须已存在且为 secret 类型，不能用字符串拼接插值。

公开响应含资源标识、kind、folder、plain 及秘密摘要，不返回秘密值；摘要 *** 表示该种类声明的字段，不证明每个可选凭据实际已填。plain 会原样可读/导出；secret 通过部署秘密后端加密。脚本/依赖的发布版本按快照规则冻结，uses 无 (live) 时亦冻结，不可把所有依赖描述为每次读 live；资源读取/代理操作和显式实时 secret IO 是不同边界。

## 脚本秘密边界

提供方凭据/私密材料由平台代理操作应用，不交给脚本助手。不可使用已移除的 r.secret/r.auth_headers 写法。plain 原始头/配置仍可见，应在支持位置使用引用。

## 最小配置：管理 API / CLI 文件

下面是创建请求 JSON，同时也是合法 YAML，可作为 `resource.yaml` 交给真实 CLI 命令。域名/凭据均为测试值，生产使用前须替换并完成前置条件；不要把真实 secret 文件提交仓库。

```json
{
  "name": "demo",
  "folder": "",
  "kind": "crypto_key",
  "plain": {
    "algorithm": "hmac",
    "key_encoding": "utf8",
    "key_id": "fixture-hmac"
  },
  "secret": {
    "key": "documentation-fixture-key-not-for-production"
  }
}
```

```sh
viat project select <slug>
viat resource create --file resource.yaml
viat resource show demo --json
```

等价 API 为 `POST /projects/{slug}/resources`（相对实例管理 API 根），请求体如上。预期得到已保存资源的公开表示和掩码摘要，不是秘密回显；示例名已存在则 409。仓库同步时去掉 folder，把配置放 `resources/demo.yaml`；`viat push` 可同步完整 plain 及未被占位过滤的 secret。创建成功不保证每个远程动作成功。

## SDK 操作与示例

Python 提供 sign/verify/encrypt/decrypt、jwt_sign/jwt_verify、export_public_key、generate_data_key；TS 对应 sign/verify/encrypt/decrypt、jwtSign/jwtVerify、exportPublicKey、generateDataKey。字符串默认 UTF-8，encoding 可为 base64/hex，bytes 自动编码。签名/密文默认 base64，解密文本 UTF-8，output="bytes"（TS 选项）返回字节。verify 返回 bool。按操作可选 hash/padding/mode/iv/aad/format/layout/uid：RSA 签名默认 PKCS#1 v1.5、加密 OAEP，ECDSA 为 P-256/SHA-256，SM2 用 SM3、密文默认 C1C3C2，SM4 默认 CBC。AES 不选原始模式时用随机认证封装 token。CBC/ECB 用于互操作，不建议新格式。generate_data_key 故意返回明文数据 key 和包装形式，结果须保护。

这两个完整脚本均声明同一个根资源 demo；在获批准的测试运行中使用。写入、发送、构建和数据删除不是 dry-run。

### Python

```python
# @resource demo
from viat import ctx

def main():
    signature = ctx.resources.demo.sign("fixture payload")
    return {"valid": ctx.resources.demo.verify("fixture payload", signature)}
```

### TypeScript

```typescript
// @resource demo
import { ctx } from "viat";

export async function main() {
  const signature = await ctx.resources.demo.sign("fixture payload");
  return { valid: await ctx.resources.demo.verify("fixture payload", signature) };
}
```

### Rust

Rust 的已验证表面是 `ctx.resource(name)` 的通用 `call(op,req)`（library 用 `ctx.library`）；不是照搬 Python 方法名。下面展示对应协议调用，返回原始操作结果，可能不同于上方复合示例。

```rust
// @resource demo
use serde_json::{json, Value};
use viat::{Ctx, Error};

fn main() {
    viat::serve(|ctx: &Ctx, _args: Value| -> Result<Value, Error> {
        ctx.resource("demo").call("crypto", json!({"op":"sign","data":"fixture payload"}))
    });
}
```

Shell 没有方法装饰的 ctx.resources，仅有 JSON 环境投影；不能把上述方法名直接写成 shell 函数。binary 程序可按 worker 协议实现相应 RPC，并非自动拥有 Python/TypeScript 方法。sql 语言仅用于四种 SQL 数据源，viat_gql 仅用于 PostgreSQL/MySQL/SQLite，graphql 语言用于远程 graphql，llm 语言用于 llm；不支持的组合不会自动适配。

### 预期结果

HMAC 签名→验签返回 {valid:true}，无网络/提供方调用。

## Test 行为与副作用

解析并在可行时签名→验签/封装→解封自测，仅公钥只证明可解析，不联系外部激活/签名服务。

管理 API 使用 `POST /projects/{slug}/resources/{name}/test?folder=`；CLI 为 `viat resource test demo`。API 检查响应体 `ok`：连接失败通常仍为 HTTP 200 `{ok:false,error:"…"}`，可能附 `schema_warnings`，不能只检查状态码。CLI 失败会非零退出。仅在允许出站/文件动作后执行。

## 常见失败与恢复

resource.crypto_key.&lt;code&gt; 带材料/操作原因，应修正编码、大小、PEM、冲突字段。仅公钥不能签名/解密。签名不匹配可返回 false，认证解密失败可能篡改/错 key/格式，不应关闭认证绕过。

管理错误一般为 `{error,message}`。DTO 的 `resource.<kind>.*` 经常位于 400 `bad_request` 的 message，而非顶层 error；不要把它们当成所有运行时助手都会返回的统一枚举。401 先恢复平台登录，403 检查有效项目角色/运行时规则，404 检查 folder/name，409 先解决同名或 `resource_in_use` 引用。远程拒绝与平台拒绝分开诊断，重试前判断上一次动作是否可能已生效。

## 生产注意与清理

协议要求唯一时不可复用 IV/nonce，约定编码与 SM2 UID。密钥在 Git 外安全备份，并保留旧材料到验证窗口结束。删资源可能使保留密文不可读，不是可逆清理。

通用删除步骤：先停用调用脚本、代理/CRUD 目标及相关触发器，迁移依赖并保留需要的证据，再用 `viat resource delete demo` 或 DELETE 详情路由。409 `resource_in_use` 时先重新绑定/删除消息指出的端点，不应强行绕过引用。删除配置资产不等于撤销第三方凭据、删除外部数据或回滚已发生副作用。

## 相关资源与维护依据

- [Secret 资源](secret.md)
- [Config 资源](config.md)
- [资源总览](index.md)

固定契约：`contracts/1.1.0/resources.json` → `resource.crypto_key`。

核对实现（产品仓库相对路径）：viat-core/src/types/resource.rs (KindSpec/Plain/Secret); viat-api/src/dto.rs (normalization/validation); viat-api/src/handlers/resources.rs (CRUD/Test); viat-runtime/src/resource_io.rs, resources_json.rs, python.rs, typescript.rs; viat-api/src/runner/broker.rs; viat-cli/src/main.rs and repo/resources.rs; viat-core/src/types/snapshot.rs.
