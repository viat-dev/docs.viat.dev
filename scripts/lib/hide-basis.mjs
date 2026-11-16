// The closing "核验依据 / Verification basis" section is maintenance evidence
// (contract source pointers for re-verification), not reader content. It
// stays in the page source and in the per-page Raw Markdown export, but the
// website and the offline book drop it at render time — the page banner above
// the content already shows the verified release.

export const BASIS_TITLES = new Set(['核验依据', 'Verification basis']);

const headingText = (node) =>
  node.type === 'heading' && node.depth === 2 &&
  node.children.every((child) => child.type === 'text') &&
  BASIS_TITLES.has(node.children.map((child) => child.value).join('').trim());

/** Site-side remark transform: remove the trailing evidence section. */
export function remarkHideVerificationBasis() {
  return (tree) => {
    if (!Array.isArray(tree.children)) return;
    const index = tree.children.findIndex(headingText);
    if (index < 0) return;
    let end = tree.children.length;
    for (let i = index + 1; i < tree.children.length; i += 1) {
      const node = tree.children[i];
      if (node.type === 'heading' && node.depth <= 2) { end = i; break; }
    }
    tree.children.splice(index, end - index);
  };
}

/** Book-side text transform with the same semantics as the remark plugin. */
export function stripVerificationBasis(markdown) {
  const lines = markdown.split('\n');
  let inFence = false;
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^##\s+(核验依据|Verification basis)\s*$/.test(line)) { start = i; break; }
  }
  if (start < 0) return markdown;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(0, start).concat(lines.slice(end)).join('\n').replace(/\n{3,}$/, '\n');
}
