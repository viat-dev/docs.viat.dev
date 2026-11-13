---
title: "启动stderr与独占池恢复（预览）"
description: "避免启动stderr阻塞READY，并在有权限的健康独占组提交后恢复脚本准入。"
doc_id: operations.worker-startup-recovery-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

这些未发布修复建立在[启动资源所有权](worker-lifecycle-preview.md)及[独占组协调](dedicated-startup-preview.md)之上，不增加启动并发、不改变通道选择，也不是新的稳定版保证。

## READY之前就读取stderr

合法worker在宣布READY之前，可能因依赖安装或模块导入向stderr写入超过管道容量的内容。如果等READY之后才读stderr，就形成相互等待，把健康启动误报为超时。

启动owner现在立即启动stdout和stderr两个reader。等待READY期间，stderr只保留最近4096个原始字节，没有换行符也不会无限缓存整行。失败诊断对这段尾部作有界、UTF-8安全的呈现；非法字节或半个多字节字符不会令诊断路径panic。外围错误还有自己的前缀，因此4096不是整个序列化响应的长度限制。

READY流程包括reader交接确认，之后slot才接受第一个请求。同一个受拥有的stderr task随后将运行时日志行交给当前请求的sink。运行时日志保持整行，不按启动缓冲边界拆分，以保留逐行masking行为；有损解码避免启动阶段切到半个UTF-8字符后悄悄丢失后续运行时日志。运行时整行交给sink后，容量大于8KiB的缓冲分配会释放，不由常驻reader继续保留。这限制的是留存容量，不是单条运行时日志行长度；不引入新的截断规则，也不承诺操作系统RSS立即下降。

READY前关闭stderr仍然合法：只要control/stdin正常，worker不必一直保持stderr打开。启动future丢弃、显式取消、启动失败和driver清理均保留两个reader task的所有权，继承管道的其他writer不能让已放弃的reader无限存活。

READY预算不变。失败时，在请求进程终止后，stderr沿用最多500ms的尽力排空窗口，之后沿用直属child的reap处理。取消不必等待诊断排空窗口。这些是清理预算，不是完整进程树或整个HTTP请求的墙钟截止。

## 健康独占组提交时恢复准入

替代pinned组可能等待旧组退休。此时，同一脚本其他内容fingerprint的合法请求仍可能共享启动失败，触发既有script级熔断。仅在登记替代任务时清除熔断，覆盖不到这些稍后的失败：新组虽已READY，正常准入仍可能报broken。

仍有提交权限的完整组成功提交时，现在会在同一个状态锁临界区内，拦住旧shared启动、安装ready组，并清除脚本此前的启动失败连续计数和broken标记。只有实际移除了broken标记，才对broken-script指标减一。

这一新增恢复动作仅在既有current ticket、项目generation、归属、取消及已知worker健康检查均通过后执行。失败、取消或过时代际的完成/清理无权抹掉较新的失败状态；其他既有显式build/publish重置路径不变。

这**不会**把熔断改成按fingerprint计数，也不按script.version排列提交权限。已发布与草稿内容仍可并存，提交后新的合法失败仍可能再次触发script级熔断。READY提交仅证明当时已知的健康，不保证worker未来一直存活，也不保证换源码零停机。

## 验证边界

受控本地worker覆盖超过管道容量的stderr、无换行输出、非法字节、失败尾部保留、交接后运行时日志、提前关闭stderr，以及取消/清理。独立reader测试在失败后仍保留writer，验证清理有界；运行时完整日志行也跨读取缓冲边界验证。

独占组回归使用退休与启动屏障：替代组等待时，另一fingerprint实际启动失败三次，然后成功提交恢复准入。替代启动失败、过时完成都必须保留较新的broken状态，之后仍有权限的成功提交才可清除。所有fingerprint刻意使用相同script.version，避免错误的版本排序让测试碰巧通过。

不涉及生产资源或供应商服务。这些修复不同时解决旧API规划副作用、Widget修复意图、authorizer密钥替换、取消ticket的内存留存或bundle导出的比较开销。
