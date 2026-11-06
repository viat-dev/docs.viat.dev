# Hello endpoint fixture / 首个端点夹具

This file is shared by the Chinese and English first-endpoint guide. A
`fixture=hello-endpoint/hello.py` code fence is checked byte-for-byte (apart
from trailing newlines) against `hello.py` during the content check.

本目录的 `hello.py` 是首个端点中英文指南的共享源码。内容检查会比较带
`fixture=hello-endpoint/hello.py` 标记的代码块，防止正文与示例漂移。

## Local validation / 本地校验

From the repository root / 在仓库根目录：

```sh
npm run validate:examples
```

Requires Python 3. It checks three function results and captured log output.
It does **not** sign in, create a project, publish an anonymous route, run the
Viat worker protocol, validate server-side coercion, or prove API integration.
No external services or credentials are required. There are no remote objects
to clean up.

需要 Python 3，只断言三组函数结果和日志输出，不会登录、建项目、发布匿名接口，
也不覆盖 Viat 工作进程协议、服务端参数转换或 API 集成。不需要凭据或外部服务，
没有远端清理动作。

For the explicit, user-driven server steps, prerequisites and cleanup, read
[English](../../src/content/docs/en/getting-started/first-endpoint.md) or
[简体中文](../../src/content/docs/zh-cn/getting-started/first-endpoint.md).
Use a disposable project you own; do not overwrite another project's route.
