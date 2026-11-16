// Book-side handling for the handbook's plain-Markdown tabs (:::tabs blocks).
//
// The website renders them as a real tab widget (scripts/lib/tabs-remark.mjs);
// offline outputs must stay readable without any script, so this module
// converts the same lines into bold panel labels and turns GitHub-style
// alert markers into explicit bold callouts.

const ALERTS = {
  'NOTE': 'Note',
  'TIP': 'Tip',
  'IMPORTANT': 'Important',
  'WARNING': 'Warning',
  'CAUTION': 'Warning',
};

/** Line-based conversion used by the mdBook export (and any plain reader). */
export function convertTabsForBook(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  for (const line of lines) {
    if (line.trim() === ':::tabs' || /^:::tabs\s+id=[A-Za-z0-9_-]{1,64}$/.test(line.trim())) {
      out.push('', '<!-- tabs -->', '');
      continue;
    }
    const panel = line.trim().match(/^::tab\s+(.+?)\s*$/);
    if (panel) {
      out.push('', `**${panel[1]}**`, '');
      continue;
    }
    if (line.trim() === ':::') {
      out.push('');
      continue;
    }
    const alert = line.trim().match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/);
    if (alert) {
      out.push(line.replace(/\[![A-Z]+\]/, `**${ALERTS[alert[1]]}:**`));
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

/** Authoring guard: marker lines that would not render as tabs are errors.
 * Markers must sit alone in their own paragraph (blank line before and after
 * any marker that neighbours prose), because the site transform matches them
 * as whole paragraphs. */
export function tabSyntaxErrors(markdown) {
  const errors = [];
  const lines = markdown.split('\n');
  let inFence = false;
  let depth = 0;
  let panels = 0;
  const isMarker = (text) =>
    text === ':::tabs' || /^:::tabs\s+id=[A-Za-z0-9_-]{1,64}$/.test(text) || text === ':::' || /^::tab\s+(.+?)\s*$/.test(text);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const text = line.trim();
    const opens = text === ':::tabs' || /^:::tabs\s+id=[A-Za-z0-9_-]{1,64}$/.test(text);
    const panel = text.match(/^::tab\s+(.+?)\s*$/);
    if (opens || panel || text === ':::') {
      for (const neighbour of [lines[index - 1], lines[index + 1]]) {
        const adjacent = (neighbour ?? '').trim();
        if (adjacent && !isMarker(adjacent)) {
          errors.push(`line ${index + 1}: surround tab marker lines with blank lines`);
          break;
        }
      }
    }
    if (opens) {
      if (depth) errors.push(`line ${index + 1}: nested :::tabs is not supported`);
      depth = 1;
      panels = 0;
    } else if (panel && depth) {
      panels += 1;
    } else if (text === ':::') {
      if (depth && !panels) errors.push(`line ${index + 1}: :::tabs needs at least one ::tab panel`);
      depth = 0;
    } else if (panel && !depth) {
      errors.push(`line ${index + 1}: ::tab marker outside a :::tabs block`);
    }
  }
  if (depth) errors.push('unterminated :::tabs block');
  return errors;
}
