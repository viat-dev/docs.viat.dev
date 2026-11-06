---
title: 'LLM prompt scripts'
description: 'The existing multi-provider template grammar, output and safety limits.'
doc_id: script.llm
verified_release: '1.1.0'
channel: stable
---

# LLM prompt scripts

Language `llm` uses Viat 1.1.0's existing provider abstraction: `openai`, `anthropic`, `azure`, `custom`. It is not a current-provider-SDK tutorial. Declare exactly one `llm` resource with a **configured, available model/deployment**, correct endpoint and credentials. No universal model ID or free request is implied. Do not run a real model call or incur billing without explicit opt-in.

## Complete minimal template

With an existing resource `assistant` pointed at an isolated fixture or an explicitly approved configured model, save `scripts/summary.llm`:

```text
# @resource assistant
# timeout: 30
Summarise the following text in one sentence for {{ audience }}:

{{ text }}
```

```bash
viat script create --name summary --language llm --file scripts/summary.llm
viat script run summary --args '{"audience":"engineers","text":"The fixture is ready."}'
viat script update summary --file scripts/summary.llm
```

Expected **shape**, not deterministic prose: `{"content":"...","model":"configured model","usage":null,"tool_calls":[]}` (usage may be a provider-reported token object). A deterministic fixture can return `content: "Fixture summary."`; production model wording is not a test oracle. The runtime serializes the shared chat reply, including `tool_calls` (normally empty because templates do not offer tools); the extracted output schema currently lists only content/model/usage. No model call has been made here.

## Exact grammar and defaults

The entire non-comment body is one user prompt. All lines whose left-trimmed text starts with `#` are removed, not just recognized directives; a Markdown heading starting with `#` therefore disappears. The remaining body is trimmed and must be nonempty.

Only `{{ name }}` is substituted, with identifier `[A-Za-z_][A-Za-z0-9_]*`. Whitespace inside braces is allowed. A missing or null variable fails before a provider call rather than rendering empty. String values render bare; other JSON values render compact JSON when directly run (endpoint extracted input declares each variable required string). Repeated placeholders deduplicate in schema. There are no dot paths, loops, conditionals, filters, template includes or system-prompt declaration. Unrecognized brace syntax is not a new feature; do not assume it evaluates.

The script sends one `user` message with default chat options. Provider defaults, including model, come from the resource; custom parameters belong in resource configuration or helper calls. Azure uses the configured deployment name. No package requirements, main function, `ctx`, native tools or template streaming exists.

## When to use a general language

Python/TypeScript can call `ctx.resources.assistant.chat(messages, ...)` for system/user/assistant/tool messages, max_tokens, temperature, JSON mode (best effort), tools, tool_choice and provider extras. Reply is `{content,model,usage,tool_calls}`. Tools have `{name,description?,parameters}` and calls `{id,name,arguments}`; the platform normalizes providers but never executes the requested functions. Guard iteration count, validate arguments (malformed arguments may remain raw text), decide authorization before each tool, and append assistant calls plus corresponding tool results to the conversation. A tool-only turn can have empty content without being a failure.

`chat_stream` (Python) / `chatStream` (TypeScript) yields text deltas; tool-bearing streaming requests are refused. Pair with a script `ViatStream` only when appropriate; the `.llm` template itself always returns a buffered reply. [Runtime](runtime.md) explains stream/cancellation limitations.

## Errors, verification and cleanup

Empty prompt, wrong/multiple resource kinds and missing variables fail locally. Network transport errors, provider HTTP/API refusal, malformed provider response and timeout are separate failures; workflow retry classification does not mean every 429/500 provider body is automatically retried. Prompt text is untrusted data when it comes from a caller; do not use model output as authorization or executable code.

Use a fixture to assert the rendered user message and output shape before any billed verification. Do not log resource keys or sensitive prompt content. Public endpoints also need appropriate auth, rate/budget controls and explicit publication. Delete only disposable script/endpoint fixtures; deleting a Viat script does not cancel provider charges already incurred. [LLM resource](../resources/llm.md) owns provider fields, and [Testing](testing.md) distinguishes offline from real runs.
