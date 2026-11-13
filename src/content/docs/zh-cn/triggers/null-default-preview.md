---
title: "参数显式 null 默认值（预览）"
description: "在端点编辑、仓库同步和已发布分发中保留显式 null 默认值。"
doc_id: triggers.null-default-preview
verified_release: 'unreleased'
channel: preview
contract_ids: []
---

这是针对[HTTP端点契约](http.md)中参数声明的未发布修复，不新增CRUD默认值机制，也不代表稳定版本已支持。

## 缺席与null不同

此前，声明中的 `default: null` 会在反序列化时被丢弃。修复后的共用类型保留以下区别：

- 没有 `default` 键：不注入端点默认值，目标沿用参数缺席时的原有行为。
- `default: null`：绑定后的参数缺席时，注入JSON null。
- 已提供的参数不被默认值覆盖。调用方显式传null，仍经过现有nullable/类型校验。

字符串body字段的null默认值需要 `nullable: true`，否则保存时返回 `400 bad_request`，详情包含 `default_value_type_mismatch`。`json` 类型本来就接受JSON null。默认值满足现有必填检查；配置了默认值时，`required` 不要求调用方必须亲自提供值。

以下是配置片段，不是已经执行的业务迁移：

```json
{
  "body_fields": {
    "remark": {"type": "string", "nullable": true, "default": null}
  }
}
```

Console参数编辑器中，默认值文本填写 `null`；留空表示没有默认值。CLI端点YAML经过 `viat pull` / `viat push` 保留同一区别。要移除默认值，在替换后的声明中省略该键，不用null表示删除。

字符串“null”应输入 `"null"`，空字符串应输入 `""`。已有默认值按JSON显示，字符串保留引号，避免保存表单时被重新解释或丢失有意义的首尾空白。普通字符串仍可不加引号输入；看起来像JSON的字符串和需要保留首尾空白的字符串应加引号。

需要同时使用修正后的server和CLI。旧CLI比较端点时也把字段的 `default: null` 归一化为缺席，导致 `diff` 隐藏差异、`push` 跳过更新，即使server已经修正。修正后的比较识别新增和移除null默认值，仍跳过真正未变的声明。这不改变管理API整对象 `overrides: null` 的清空语义，也不改变CLI省略整个overrides字段时的不管理语义。

## CRUD与恢复边界

[CRUD](crud.md)收到的是HTTP契约绑定后的参数。因此body默认值可以为允许写入的nullable列明确提供null，而不是保持缺席；数据库约束仍然生效。这与 `crud_config.defaults` 不同，后者是调用方不能覆盖且不允许null的平台身份填充。本修复不改变授权规则、可写列名单、未知字段限制或数据库默认值。

此前保存时已经丢失的默认值无法从缺席键还原。请重新填写预期配置、保存并检查返回的声明，再发布后测试公开路由。没有自动数据或端点迁移。采用CRUD替换前，应在隔离fixture中对照省略、null和显式值输入，并检查实际落库值。

## 验证边界

回归覆盖JSON缺席/null往返、CLI YAML经过API类型，以及API保存/读取/发布后的真实Python调用，也覆盖非法标量null默认值被拒绝。Console回归覆盖编辑器往返。CLI比较测试与server共用类型作一致性对照；真实CLI进程连接本地HTTP stub，覆盖新增/移除null默认值，以及跳过真正未变的声明。这些不代表业务端点已经迁移完成，也不代表验证过外部生产数据库。
