// ─── Typography ────────────────────────────────────────────────────────────
// Single place to swap the font scheme. Each role maps to a font-family stack.
// When swapping a face here, also update the matching Google Fonts <link> in
// index.html. If a new face renders visibly larger/smaller than its
// predecessor at the same px (as a true monospace often does), DON'T touch the
// ~hundreds of inline fontSize call sites — instead tune `size-adjust` in that
// font's @font-face block in index.html, which scales the glyphs globally.
//
//   display → headings           (no serif — a confident display grotesque)
//   body    → running text        (scientific names = body italic)
//   mono    → labels / data chips  (size-adjusted in index.html)
export const FONTS = {
  display: '"Schibsted Grotesk", system-ui, sans-serif',
  body: '"Hanken Grotesk", system-ui, sans-serif',
  mono: '"Spline Sans Mono", ui-monospace, monospace',
};
