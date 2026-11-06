---
title: "文件监听"
description: "监听允许的本地目录，理解稳定等待、对账扫描、claim 和有界投递。"
doc_id: triggers.watches
verified_release: '1.1.0'
channel: stable
contract_ids: []
---

# 文件监听

Watch 观察服务器实例可见文件并运行实时**脚本或工作流**，不是 S3 通知、任意远端文件系统连接器或 endpoint 目标。部署必须用 `VIAT_WATCH_ROOTS` 明确允许绝对目录，未设置则禁用。需要把隔离目录挂载到实际服务的容器/主机。API 当前对读写检查**项目成员资格**，不是队列的 editor 门槛。目录访问是服务器权限，允许根中不应包含凭据或其他租户文件。

## 完整创建示例

源码推导/未执行：先创建 `ingest`，由运维允许虚构目录 `/srv/viat-input`。

```http
POST /projects/demo/watches
Authorization: Bearer <console-token>
Content-Type: application/json

{"name":"incoming","source":{"path":"/srv/viat-input","recursive":true,"max_depth":3},"on":["created","modified"],"filter":{"include":["**/*.json"],"exclude":["**/*.tmp"],"min_size":1},"timing":{"settle_secs":5,"reconcile_secs":300,"max_fires_per_tick":50,"max_concurrent_runs":4,"max_entries":20000},"target":{"kind":"script","name":"ingest"},"inputs":{},"enabled":false}
```

响应 WatchPublic 含 `id,project_id,name,enabled,source,on,filter,timing,target,inputs,created_at,updated_at`；source/filter/timing 回显解析后的默认值，max_depth/min_size/max_size 为值或 null，target 保持 `{kind,name}`。响应投影示例：

```json
{"name":"incoming","enabled":false,"source":{"path":"/srv/viat-input","recursive":true,"max_depth":3},"on":["created","modified"],"filter":{"include":["**/*.json"],"exclude":["**/*.tmp"],"min_size":1,"max_size":null},"timing":{"settle_secs":5,"reconcile_secs":300,"max_fires_per_tick":50,"max_concurrent_runs":4,"max_entries":20000},"target":{"kind":"script","name":"ingest"},"inputs":{}}
```

## 字段及替换语义

| 字段 | 默认/条件 |
| --- | --- |
| `name` | 必填、非空白；更新应正确识别路径/body 中的 watch。 |
| `source.path` | 必填绝对路径，必须在部署 allowlist 内，否则 400，不会创建静默闲置配置；运行实例也必须可见。 |
| `source.recursive` | true；false 只扫描根层。 |
| `source.max_depth` | 省略/null 无深度限制；否则 >=1。 |
| `on` | 默认 `["created","modified"]`；非空，只能 created/modified/deleted。 |
| `filter.include`、`exclude` | 默认空数组；相对路径 glob，保存时验证语法，空 include 选全部，exclude 优先。 |
| `filter.min_size`、`max_size` | 省略/null 无界；同时存在时 min 不得大于 max；min_size 1 可过滤空占位文件。 |
| `timing.settle_secs` | 5，>=0，版本稳定后触发。 |
| `timing.reconcile_secs` | 300，>=5，完整扫描修复遗漏通知。 |
| `timing.max_fires_per_tick` | 50，限制单次扫描 claim，保持正数。 |
| `timing.max_concurrent_runs` | 4，实例内 watch 并发槽，运行时最低一槽。 |
| `timing.max_entries` | 20000，扫描上限，超过会报错/降级，不是静默覆盖一部分；保持正数。 |
| `target` | 必填且已存在 `{kind:script|workflow,name:"folder/name"}`，不支持 endpoint。 |
| `inputs` | API 缺省反序列化 null，运行时只合并对象字段；建议显式 `{}`/对象。 |
| `enabled` | API/仓库/控制台默认 true，分阶段创建用 false。 |

`PUT …/watches/<name>` 整体替换，省略可选项恢复默认。null 不是通用清空：可选 bounds 用 null 清除，集合用 `[]`，filter/timing 用 `{}` 恢复默认；必需对象/字符串/布尔不能 null。配置无需发布即可对账生效。没有独立 watch CLI，支持 `watches/<name>.yaml`、`viat pull/push`（`--only watches`）；镜像同步会删除本地缺失的远端 watch，先检查完整 checkout/diff。

## 投递与脚本输入

目标收到常量与保留 `file`（事件覆盖同名 input），含 `{path,abs_path,name,ext,size,modified_at,event}`。path 是稳定相对路径，abs_path **只在执行实例有效**；deleted 事件不表示还能打开文件。

```python
def main(file):
    return {"path": file["path"], "event": file["event"]}
```

扫描是真相，OS 通知只降低延迟；注册前已存在文件可被对账发现，通知丢失/溢出会自愈。实例按 watch/path/version 协调 claim，中断工作可重试、最多三次尝试，因此副作用需幂等。这不是全序文件事件日志：多个文件/实例/运行可重叠，稳定等待可合并中间版本。粗粒度 mtime 文件系统中，同秒同大小覆盖可能不可见。symlink/allowlist 限制遍历；挂载消失不能视为可靠的大规模删除，异常大量消失会降级并抑制 deleted，直到扫描一致。

观测入口为 `GET /projects/<slug>/watches`、`GET …/<name>`、`GET …/<name>/events`、`GET …/<name>/health`。事件行含 `id,watch_id,rel_path,event,size,modified_at,request_id,status,attempts,started_at,finished_at,error_message`，状态 claimed/running/succeeded/failed。健康返回 `summary:"serving"|"stalled"` 和 `instances:[{instance_id,hostname,status,last_scan_at,last_error}]`，实例状态 ok/degraded/unavailable。通知注册失败 degraded 仍可按 reconcile 延迟运行；stalled 意味无存活实例服务根目录，不是正常空闲。

## 恢复与清理

无事件先查 allowlist、挂载/权限、health、glob/大小、settle、扫描上限和目标环境，不要未经授权向生产采集目录写测试文件。隔离根中创建虚构文件，核对相对路径、事件账本和执行输出。目标受运行时 timeout；禁用不会回滚，也不保证取消当前运行。完整 PUT 保留配置并禁用，处理在途工作，再 `DELETE …/<name>`；只删除自己建立的测试文件。没有通用事件重放 API，修复目标后应结合已有副作用明确重放业务工作。

依据：`crates/viat-api/src/handlers/watches.rs`、`watcher/{mod,scan,filters}.rs`、watch 账本查询/测试；`crates/viat-cli/src/repo/watches.rs`；控制台 `pages/watches/WatchDrawer.tsx`。示例源码推导/未执行，未验证文件系统和多实例行为。
