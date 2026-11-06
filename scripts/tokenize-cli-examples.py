"""Lex documentation, never execute a command or read the user's environment.

The output is parser input, not a runnable script. Explicitly record examples
that need manual shell review instead of treating an omitted example as passed.
"""
import json
import re
import shlex
import sys

UUID = "11111111-1111-4111-8111-111111111111"


def fixture(name):
    key = name.lower().replace("-", "_")
    if key.endswith("id") or "uuid" in key:
        return UUID
    if "json" in key or key in ("args", "input", "body"):
        return "{}"
    if key in ("n", "count", "seconds", "secs", "port", "limit") or key.endswith(("_secs", "_port", "_limit")):
        return "10"
    if "email" in key:
        return "reader@example.invalid"
    if key in ("server", "viat_server", "base", "base_url"):
        return "http://127.0.0.1:8080"
    return "fixture"


def collect(blocks):
    collected, manual = [], []
    for block in blocks:
        # Joining shell continuations does not evaluate variable substitutions.
        text = re.sub(r"\\\r?\n\s*", " ", block["value"])
        for index, line in enumerate(text.splitlines(), 1):
            line = line.strip()
            if not re.match(r"^viat(?:\s|$)", line):
                if re.search(r"(?:\$\(|\bthen\s+|\bdo\s+)viat\s", line):
                    manual.append({"page": block["page"], "block_line": index, "original": line, "reason": "embedded shell invocation"})
                continue
            record = {"page": block["page"], "block_line": index, "original": line}
            if "$(" in line or "`" in line or re.search(r"[|;&<>]", re.sub(r"<[A-Za-z][A-Za-z0-9_./ -]*>", "fixture", line)):
                manual.append({**record, "reason": "shell operators/substitution require explicit token fixture"})
                continue
            normalized = re.sub(r"<([A-Za-z][A-Za-z0-9_./ -]*)>", lambda m: fixture(m[1]), line)
            try:
                argv = shlex.split(normalized, comments=True, posix=True)
            except ValueError as error:
                manual.append({**record, "reason": str(error)})
                continue
            unresolved = False
            substitutions = []
            for position, token in enumerate(argv):
                # JSON keys such as $secret are protocol data, not shell names.
                # Semantic expansion inside a quoted payload is not simulated.
                if token.lstrip().startswith(("{", "[")):
                    continue
                def replace(match):
                    name = match.group(1) or match.group(2)
                    substitutions.append(name)
                    return fixture(name)
                argv[position] = re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)", replace, token)
                if "$" in argv[position] and not token.lstrip().startswith(("{", "[")):
                    unresolved = True
            if unresolved:
                manual.append({**record, "reason": "unsupported variable expression"})
            else:
                collected.append({**record, "argv": argv, "substitutions": sorted(set(substitutions))})
    return {"collected": collected, "manual": manual}


if __name__ == "__main__":
    json.dump(collect(json.load(sys.stdin)), sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
