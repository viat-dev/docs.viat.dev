// Site-side remark transform for the handbook's plain-Markdown tabs.
//
// Authors write, at any block level:
//
//   :::tabs id=login-ways
//   ::tab 控制台
//   …markdown…
//   ::tab CLI
//   …markdown…
//   :::
//
// remark parses the marker lines as plain paragraphs; this plugin regroups
// the siblings between them into one container rendered as a real tab widget
// on the website. The offline mdBook export instead converts the same lines
// into labelled sections (scripts/lib/tabs.mjs), so no content is MDX-only
// and every tab body stays readable everywhere.
//
// The group id is optional; tabs sharing an id keep their selection in sync
// across a page (and across pages, via localStorage).

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const paragraphText = (node) =>
  node.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'text'
    ? node.children[0].value
    : null;

const openTabs = (text) => {
  if (text === ':::tabs') return { id: '' };
  const match = text?.match(/^:::tabs\s+id=([A-Za-z0-9_-]{1,64})$/);
  return match ? { id: match[1] } : null;
};
const panelMarker = (text) => {
  const match = text?.match(/^::tab\s+(.+?)\s*$/);
  return match ? match[1] : null;
};

function buildTabsNode(group, labels, panelChildren) {
  const buttons = labels
    .map((label, index) => {
      const selected = index === 0 ? ' aria-selected="true"' : ' aria-selected="false"';
      const tabindex = index === 0 ? '' : ' tabindex="-1"';
      return `<button type="button" role="tab" class="vtabs-tab" data-vtab="${index}"${selected}${tabindex}>${escapeHtml(label)}</button>`;
    })
    .join('');
  const tablist = {
    type: 'html',
    value: `<div class="vtabs-list" role="tablist">${buttons}</div>`,
  };
  // Panels are NOT pre-hidden in the markup: without JavaScript every tab body
  // stays visible (same reading experience as the offline book), and the
  // client script hides inactive panels as soon as it runs.
  const panels = panelChildren.map((children) => ({
    type: 'vtabsPanel',
    data: {
      hName: 'div',
      hProperties: { className: ['vtabs-panel'], role: 'tabpanel' },
    },
    children,
  }));
  const properties = { className: ['vtabs'] };
  if (group) properties['data-vtabs-group'] = group;
  return { type: 'vtabs', data: { hName: 'div', hProperties: properties }, children: [tablist, ...panels] };
}

/** Rewrite every children array that contains a well-formed :::tabs block. */
export function remarkViatTabs() {
  return (tree) => {
    transform(tree);
  };
}

function transform(node) {
  if (!Array.isArray(node.children)) return;
  for (let i = 0; i < node.children.length; i += 1) {
    transform(node.children[i]);
  }
  for (let i = 0; i < node.children.length; i += 1) {
    const opening = openTabs(paragraphText(node.children[i]));
    if (!opening) continue;
    const labels = [];
    const panels = [];
    let cursor = i + 1;
    let current = null;
    let closed = false;
    for (; cursor < node.children.length; cursor += 1) {
      const child = node.children[cursor];
      const text = paragraphText(child);
      const label = panelMarker(text);
      if (label) {
        if (current) panels.push(current);
        labels.push(label);
        current = [];
        continue;
      }
      if (text === ':::') {
        closed = true;
        break;
      }
      if (current) current.push(child);
    }
    if (!closed || !labels.length || !current) continue;
    panels.push(current);
    const replacement = buildTabsNode(opening.id, labels, panels);
    node.children.splice(i, cursor - i + 1, replacement);
  }
}
