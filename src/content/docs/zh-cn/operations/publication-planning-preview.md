---
title: "规划副作用与取消启动的源码释放（预览）"
description: "拦住过时池规划的异步状态回写，并在不绕过worker退休预算的前提下释放旧源码。"
doc_id: operations.publication-planning-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

这是[独占启动协调](dedicated-startup-preview.md)和[启动恢复](worker-startup-recovery-preview.md)之后的未发布补修。改动的是池规划权限与所有权，不改变已发布路由的事务边界或允许启动的worker数量。

## 在真正修改状态时检查权限

池reconcile已经在第一次异步读取脚本前取得项目scope。现在，该scope继续传递到协调阶段的熔断重置、缺失环境探测及环境构建完成，而不是只保护最后的desired worker集合应用。

每次带scope的状态修改先取得池状态锁，再持有policy锁检查所属supervisor、项目、当前generation、取消及closing状态。实际修改和同步事件入队都在这两个锁的保护下进行，新计划不能插进“预检查通过”与“写状态”之间。新增reset/build/probe回写临界区内不等待文件或进程操作；这些回写所需的源码/依赖哈希和事件元数据在加锁前准备。

一旦被较新的scope取代，旧规划不能再：

- 通过旧熔断重置或构建成功回写，取消较新的shared启动ticket。
- 添加validated状态、清除较新的broken/失败状态，或用晚到结果覆盖当前环境报告。
- 向环境mirror发布过时的Ready/Failed/移除事件。

物理构建仍可能完成，并返回该次实际工作的提示性结果。依赖缓存写入及其他外部副作用不会回滚；池状态回写被阻止，不代表物理工作从未发生。

## 带规划scope时的环境报告

环境key由语言及规范化requirements共享，并不属于某一个项目或脚本；普通Building记录没有operation owner。本轮不引入新的全局环境版本协议，而选择让协调scope内的构建**不写入或发布全局Building标记**。物理工作期间仍可见此前的环境状态，scope被丢弃也不会新留下一条幽灵Building。

这适用于发布后的池协调及启动期缺失环境预热，不是改变一次publish请求内的每一个操作。其他前置校验调用、编辑器测试、显式build与触发器预热保留原有无scope接口和行为。缓存/门控构建不会被改成发布scope，发布构建也不新加入其single-flight机制。

仍有权限的scoped构建成功时，保留既有Ready覆盖恢复语义，包括替换可能由此前无scope构建留下的无owner Building。带scope的负面结果和probe不会抹掉已有Building标记。因此这是项目规划边界，**不是对不同脚本/项目全部环境操作的全序保证**，也不代表解决了所有既有无scope报告竞态。环境mirror仍是尽力同步，可以滞后。

在这个带scope阶段，旧的Ready/Failed/缺席状态不能证明当前没有构建；操作返回的逐脚本build结果仍是物理工作的提示性结果。普通build入口保持原有活动报告。

## 区分启动结果与退休完成

过时dedicated启动ticket可能一直等在旧worker的长请求之后，尚未开始自己的物理准备。取消现在会及时释放该ticket的完整Script payload及supervisor引用；reconcile和自动升池的结果等待者只保留轻量receiver，不再持有完整启动记录。

清理任务不会消失：它继续拥有真正的退休worker和轻量完成token，直到前驱和本批退休都结束。即使取消ticket已从目录移除，甚至最后一个caller被取消时还没有后继任务，按脚本记录的预算栅栏仍保留。后续替代组不能因源码已释放就绕过退休等待。

因此，取消结果可以先于前驱退休完成返回。这不会中止健康旧请求、提前释放物理启动许可或提供额外surge预算。已经进入不可中止layout准备的工作，仍保留所需所有权直到结束。原有shared/stream/long-run fallback规则不变。

本修复去掉的是等待链中不断累积的旧**源码副本**，不宣称总内存为常数。轻量栅栏元数据仍可能保留到退休结束，调用方或其他子系统也可能合理地持有自己的源码副本。

## 验证边界

规划回归驱动API适配层实际使用的状态修改/完成函数，覆盖过时reset/success/failure/probe及事件、等状态锁期间被取代、supervisor/project不匹配、closing、完整依赖key、不创建scoped Building，以及有权限地恢复无owner标记。没有把pool-launch测试hook冒充成真实依赖安装器，也没有声称复现了每种API/数据库交错。

受控worker fixture持有一个退休sender，反复取代并取消替代任务，在允许退休完成前观察Weak引用释放和supervisor引用计数。之后登记的新替代组仍必须等待，旧worker仍可执行，释放后只有最新源码真正启动。既有发布、build、生命周期和shutdown回归仍须通过。

这些改动不会使发布变成跨资产事务，不按script.version排列回滚权限，不回滚外部副作用，也不保证旧长流存在时可以零停机替换。
