#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import "design/tokens.typ": tokens
#import "design/theme.typ": palette

#set page(width: auto, height: auto, margin: 14pt, fill: palette.surface)
#set text(font: tokens.font, fill: palette.ink, size: tokens.size-body)

#let card(glyph, title, kind, desc, hue) = block(
  width: 146pt,
  stack(
    dir: ttb,
    spacing: tokens.gap-structured-text,
    block(width: 100%, align(center, text(
      size: tokens.size-title, weight: tokens.weight-bold, fill: hue.ink,
      glyph + "  " + title,
    ))),
    block(width: 100%, align(center, text(
      size: tokens.size-label, fill: hue.ink.lighten(20%), "(" + kind + ")",
    ))),
    line(length: 100%, stroke: 0.6pt + hue.divider),
    // Fletcher centres node content; the description reads better ranged left.
    block(width: 100%, align(left, text(size: tokens.size-caption, fill: hue.ink, desc))),
  ),
)

#let stage(pos, glyph, title, kind, desc, hue, name) = node(
  pos,
  card(glyph, title, kind, desc, hue),
  shape: fletcher.shapes.rect,
  fill: hue.fill,
  stroke: tokens.stroke-default + hue.stroke,
  corner-radius: tokens.radius-shape,
  inset: tokens.pad-inside-shape,
  name: name,
)

#let flow(from, to, label) = edge(
  from, to, "->",
  stroke: tokens.stroke-default + palette.ink-muted,
  label-fill: palette.surface,
  label-sep: tokens.label-sep,
  text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.ink, label),
)

#align(center, text(size: tokens.size-heading, weight: tokens.weight-bold,
  "How a code change reaches a phone"))

#v(tokens.gap-cell)

#diagram(
  spacing: (tokens.space-between-shapes * 2.4, tokens.space-between-ranks),

  stage((0, 0), "\u{F109}", "This machine", "authoring",
    "Edit index.html. One static file, no build step.",
    palette.purple, <dev>),

  stage((1, 0), "\u{F09B}", "GitHub repo", "source of truth",
    "superrcharge/dinner-decisions, public. Public is what makes Pages free.",
    palette.blue, <repo>),

  stage((2, 0), "\u{F0AD}", "Pages build", "ci",
    "Copies the repo to the Pages origin. Nothing is compiled.",
    palette.yellow, <build>),

  stage((3, 0), "\u{F0C2}", "Fastly edge", "cdn",
    "Serves the file worldwide. Cache-Control: max-age=600.",
    palette.orange, <edge>),

  stage((4, 0), "\u{F10B}", "Family phone", "browser",
    "Any phone, any browser. No account and no app install - just the family "
    + "name and code, once.",
    palette.green, <phone>),

  flow(<dev>, <repo>, "git push"),
  flow(<repo>, <build>, "triggers"),
  flow(<build>, <edge>, "publishes"),
  flow(<edge>, <phone>, "GET /"),
)

#v(tokens.gap-cell)

#align(center, block(width: 560pt, text(
  size: tokens.size-caption, fill: palette.ink-muted, style: "italic",
  "A push reaches every phone within about ten minutes: the Pages build takes " +
  "seconds, then the edge cache holds the previous copy until max-age expires. " +
  "Nobody has to watch for it - the app asks the edge periodically whether a " +
  "newer build is available and offers a reload once one actually is, which " +
  "matters because a phone running it from the home screen has no address bar " +
  "and no pull to refresh.",
)))
