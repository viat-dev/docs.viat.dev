---
title: 安装并连接客户端
description: 安装实际可获得的已签名 Apple 客户端、启用附带 CLI，并连接已有实例，同时区分产物可用性与源码能力。
doc_id: installation.clients
verified_release: '1.1.0'
channel: stable
---

# 安装并连接客户端

原生应用版本为 **0.1.0**,与 **server/CLI 1.1.0** 独立。本页描述契约源码
`03751a67` 所代表的安装前提与客户端行为。本地能生成 DMG/IPA **不等于**
已存在公开下载渠道、App Store 页面或开放 TestFlight 邀请——请通过实际
存在的分发安排取得授权产物及其校验文件;本手册**不能**提供尚未发布的
下载 URL。

官方服务端镜像已内置浏览器控制台——创建第一个端点**不需要**原生客户端。

## 要求与访问条件

- 可访问的实例 URL 与**平台账号**(不是项目终端用户/API key 凭据);
  查看项目状态需要项目成员资格——平台 Owner/Admin **不会**自动加入所有
  项目。
- Mac:**Apple Silicon、macOS 13.0+**,以及适用平台的已签名、公证 DMG;
  本发行流程**不承诺** Intel/universal Mac 产物。
- iPhone/iPad:适当签名的**真机**分发产物;开发/注册设备导出要求设备被
  provisioning profile 授权——不是任意 iPhone 拿到开发 IPA 都能装。
- **设备本身**能访问实例;远程使用时 HTTPS 证书可信;正常项目操作需要
  服务端已激活。
- 本页**不承诺**稳定的原生 Windows/Linux 发行版;源码里有 Android 开发
  集成 ≠ 已有文档化的公开稳定 Android 下载。

## 1. 安装前检查产物

分发方提供经验证的发行目录时,把产物、`SHA256SUMS` 与 `release.json`
放在一起;`release.json` 记录应用/构建版本、架构、渠道、源码提交、附带
CLI 版本与产物摘要——确认与期望的平台/渠道相符。

在 manifest 与对应文件所在目录执行:

```sh
shasum -a 256 -c SHA256SUMS
```

预期每个列出的产物都是 `OK`。校验和能发现字节不一致,但**不能认证分发
者**——经可信产物渠道核对;**不要**为未知软件包关闭 Gatekeeper 或安装
来历不明的描述文件。

## 2. 在 Mac 安装或升级

1. 挂载获授权的 DMG。
2. **首次安装**:把 `Viat.app` 拖到 `/Applications`——安装位置关系到
   附带的刷新代理。
3. **升级**:先退出已有 Viat GUI,再运行 DMG 的
   `Install or Upgrade.command`;**不要**直接覆盖正在运行的应用/Widget。
   此显式安装器需要 Python 3。
4. 打开 `/Applications/Viat.app`,走正常 macOS 验证流程。发行产物应已
   签名并公证;若被拒绝,排查原因,**不要**统一绕过系统安全。

升级工具的行为:校验替换包 → 拒绝终止运行中的 GUI → 仅停止已安装
Widget 的确切可执行程序 → 替换并注册整个应用包;旧 Widget 退不出则保留
原安装;替换失败会尝试恢复旧应用,恢复也失败则报告备份位置。仅挂载 DMG
不会安装软件或终止进程。

应用与 Widget 需要 macOS 13+;原地切换实例的 `Button(intent:)` 要求
**macOS 14+**,更早的受支持系统用"打开应用"的回退入口。安装应用**不
保证**固定后台刷新周期。

### 启用附带 CLI

安装应用后:

```sh
bash "/Applications/Viat.app/Contents/Resources/install-cli.sh"
export PATH="$HOME/.local/bin:$PATH"
command -v viat
viat --version
```

- 工具在 `~/.local/bin` 创建 `viat`、`viat-test-host`、
  `viat-endpoint-test-host` 三个符号链接,**不修改** shell 配置;需要新
  终端持续生效就把目录写进正常 `PATH` 配置。已有文件默认拒绝覆盖,显式
  `--force` 才替换;目录永不替换;`VIAT_CLI_INSTALL_DIR` 可选其他目标
  目录。
- 匹配产物应报告 `viat 1.1.0`——**不是**应用的 `0.1.0`。链接指向已安装
  应用内部:移动/移除应用会影响命令。本地 Python/TypeScript 测试仍需
  单独安装 `uv`/`bun`;附带 CLI 不含全部本地测试前提。

## 3. 通过实际分发渠道安装 iOS 版本

只用与已签名产物配套的分发渠道。发布工具区分:

| 导出方式 | 含义 |
| --- | --- |
| `app-store-connect` | 面向 App Store Connect/TestFlight 提交的产物;生成 IPA **不会**上传或发布 |
| `release-testing` | 注册设备分发,**不是** TestFlight 邀请 |
| `debugging` | 使用匹配开发 profile 与授权设备的开发签名真机版本 |

应用与 Widget 需要兼容、未过期的 profile 与签名身份;注册设备分发要求
两者有共同授权设备集合。**不要**在问题报告里公开设备标识、个人签名
身份、profile 或证书;安装被拒时,请产物维护者检查 profile 覆盖范围。

本稳定手册**不**把固定版本的 iOS 发布 helper 宣传为开箱即用的开发构建
配方:后续修复尚未合并到契约基线。安装已验证产物 ≠ 重新构建/签名产物。
开发模拟器也不是真机签名测试——模拟器会话存内存,**不能**证明 Keychain
持久化或推送投递。

## 4. 添加实例并登录

1. 登录页打开实例切换器,用**基础 URL** 添加/编辑命名实例(如
   `https://api.example.com`);有部署挂载前缀要包含,**不要**含
   `/ui/` 或 `/p/<slug>`。
2. 远程实例先确认设备能连接并信任该 URL——手机上的 `localhost` 指**手机
   自己**,不是服务端或 Mac。
3. 平台邮箱/密码登录,或选运维实际配置的平台 SSO 提供商。
4. 已启用 MFA 时完成验证;要求先登记时按提示走控制台安全/登记流程,
   **不要**反复重试密码。
5. 选择自己所属的项目——Home 的实例/项目标题与 Settings → Project 用
   同一选择。
6. 刷新 Home 看近期请求与运行——**空结果与读取失败不同**,没有流量不应
   显示成连接错误。

每个实例保留独立会话与项目选择。切换实例会停止旧日志订阅、清除绑定身份
的 assistant 上下文;编辑实例 URL 会**先清理**旧凭据与项目——不会悄悄把
旧凭据发给另一台服务器;最后一个实例只能编辑、不能删除。

## 状态与 Widget 的预期

- 客户端支持项目概览、近期运行、日志与部分操作(如凭据轮换)——**不是**
  把控制台全部编辑器搬进原生应用。缓存 Widget 保留数据**原始更新时间**;
  切换所选实例本身不获取新数据;Apple 平台的稳定 reader 用每次登录独立、
  只读的 `vso_` 令牌读项目概览。何时真正刷新取决于 OS 时间线与后台预算。
- 设备不在实例网络内时**不能**假定能读私有 API。**未发布的加密 APNs
  概览快照不是稳定版方案**——本安装流程不含直接 APNs 密码学配置;IPA
  已签名、profile 有效,也**不能**证明真机推送能投递。

## 排错与清理

| 问题 | 检查 |
| --- | --- |
| Mac 工具拒绝替换文件 | 先检查已有命令;仅在有意覆盖时用 `--force` |
| Mac 升级拒绝 | 退出 GUI;按具体 Widget/备份错误处理,不要覆盖运行中应用包 |
| iOS 安装失败 | 分发方式、设备授权、profile 过期、应用/Widget 签名兼容性 |
| 登录成功但没有项目 | 实例、账号与项目成员关系是否正确 |
| `401` / MFA 拒绝 | 重新认证或完成登记;TOTP 查手机与服务端时钟 |
| `403 license_required` | 平台 Admin/Owner 需[激活实例](../instance/activation.md) |
| Widget 时间戳较旧 | 设备网络、所选实例/项目、会话与系统调度——不要推断流量为零 |
| 安全存储/Widget 缓存错误 | 报告具体操作;不可读存储不能当空账号库 |

处理共享设备前先退出登录。移除实例会清理本地凭据与关联选择/缓存;应用
在改变实例注册表前**验证凭据清理**;已渲染的系统 Widget 图像可能保留到
OS 重绘。删除 Mac 应用**不会**删除服务端、项目或平台账号,也不能假定
抹掉 Keychain 项。卸载附带工具时,只移除自己创建的 CLI 符号链接——不要
删无关命令。

## 核验依据

契约源码 `03751a67`:`client/README.md`、`client/package.json`、`client/src-tauri/tauri.conf.json`、`client/scripts/{install-bundled-cli.sh,release_client.py,embed-macos-widget.sh}`、`crates/viat-client`。产物是否已公开发布属于分发事实,不能从代码能力推断。
