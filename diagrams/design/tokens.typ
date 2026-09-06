// Values only, no color. Colors live in theme.typ so they swap per theme
// while these stay constant.

#let tokens = (
  // ---- whitespace ----
  pad-inside-shape:       10pt,
  pad-inside-container:   20pt,
  space-between-shapes:   28pt,
  space-between-ranks:    36pt,
  gap-structured-text:    5pt,
  gap-cell:               14pt,

  // ---- typography ----
  font:           "CaskaydiaMono NFP",
  size-label:     9pt,
  size-caption:   10pt,
  size-body:      11pt,
  size-title:     13pt,
  size-heading:   15pt,
  weight-light:   "light",
  weight-body:    "regular",
  weight-bold:    "semibold",

  // ---- stroke widths ----
  stroke-thin:      0.8pt,
  stroke-default:   1.2pt,
  stroke-emphasis:  2pt,

  // ---- shape geometry ----
  radius-shape:     6pt,
  radius-container: 10pt,

  // ---- edge labels ----
  label-sep:        10pt,
  label-size:       9.5pt,
)
