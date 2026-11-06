// The exporter encodes usize::MAX as null, not zero. Keeping that distinction
// visible prevents variadic positional arguments from acquiring an impossible
// upper bound in the generated reference.
export function argumentArity(range) {
  if (!range) return 'unknown';
  if (range.max === null) return `${range.min}..∞`;
  return range.min === range.max ? String(range.min) : `${range.min}..${range.max}`;
}
