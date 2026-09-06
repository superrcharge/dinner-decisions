#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import "design/tokens.typ": tokens
#import "design/theme.typ": palette

#set page(width: auto, height: auto, margin: 14pt, fill: palette.surface)
#set text(font: tokens.font, fill: palette.ink, size: tokens.size-body)

// Shape-body-as-semantic: the entity's role lives in its body, so edges stay
// short and the eight relationships around the focal node do not collide.
#let card(glyph, title, kind, desc, hue, w: 152pt) = block(
  width: w,
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
    block(width: 100%, align(left, text(size: tokens.size-caption, fill: hue.ink, desc))),
  ),
)

#let box-node(pos, glyph, title, kind, desc, hue, name, w: 152pt, weight: tokens.stroke-default) = node(
  pos,
  card(glyph, title, kind, desc, hue, w: w),
  shape: fletcher.shapes.rect,
  fill: hue.fill,
  stroke: weight + hue.stroke,
  corner-radius: tokens.radius-shape,
  inset: tokens.pad-inside-shape,
  name: name,
)

#let sig(from, to, label, ..rest) = edge(
  from, to, "->",
  stroke: tokens.stroke-default + palette.ink-muted,
  label-fill: palette.surface,
  label-sep: tokens.label-sep,
  text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.ink, label),
  ..rest,
)

#align(center, text(size: tokens.size-heading, weight: tokens.weight-bold,
  "What happens when a phone opens the page"))

#v(tokens.gap-cell)

#diagram(
  spacing: (tokens.space-between-shapes * 3.1, tokens.space-between-ranks * 1.5),

  // ---- where the page comes from ----
  box-node((0, 0), "\u{F0C2}", "GitHub Pages", "static host",
    "Hands over one file: index.html. Holds no data and never sees a vote.",
    palette.orange, <pages>),

  box-node((1, 0), "\u{F0C1}", "gstatic + Fonts", "third-party cdn",
    "Firebase SDK and the two typefaces. Fetched once, then cached.",
    palette.purple, <cdn>),

  box-node((2, 0), "\u{F084}", "Firebase Auth", "identity",
    "Signs the visitor in anonymously and returns a token. Nobody makes an account.",
    palette.yellow, <auth>),

  // ---- the focal node ----
  // Centred under the three load-time sources on purpose: every edge stays a
  // short hop and none has to cross a node to reach it.
  box-node((1, 1), "\u{F2D0}", "The page", "runs in the browser",
    "All of the app. Renders tiles, resolves emoji from meal names, and holds "
    + "the live listeners. This is the only place logic runs.",
    palette.blue, <page>, w: 176pt, weight: tokens.stroke-emphasis),

  box-node((2, 1), "\u{F023}", "Security rules", "gate",
    "Checked on every read and write. Rejects anyone not signed in and any "
    + "collection outside the five below.",
    palette.red, <rules>),

  box-node((3, 1), "\u{F1C0}", "Cloud Firestore", "shared data",
    "meals \u{2022} suggestions \u{2022} people \u{2022} votes \u{2022} weeks\n\n"
    + "Doc ids are meaningful: a vote is <week>__<person>, a meal is its own slug.",
    palette.green, <store>),

  // ---- per device ----
  box-node((0, 2), "\u{F0A0}", "localStorage", "this device only",
    "Who this phone is picking as, whether it has the manage code, and a cached "
    + "copy of the lists for an instant first paint.",
    palette.pink, <local>),

  box-node((3, 2), "\u{F10B}", "The other phones", "same page, same data",
    "Each runs its own copy with its own listeners. Nothing is peer to peer; "
    + "they meet in Firestore.",
    palette.coral, <others>),

  // ---- signals ----
  sig(<pages>, <page>, "index.html"),
  sig(<cdn>, <page>, "SDK + fonts"),
  // One bidirectional edge rather than two: a return edge here bent back
  // through the CDN node and put its label on top of it.
  edge(<page>, <auth>, "<->",
    stroke: tokens.stroke-default + palette.ink-muted,
    label-fill: palette.surface,
    label-sep: tokens.label-sep,
    label-pos: 0.78,
    text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.ink,
      "sign in, get token"),
  ),
  edge(<page>, <local>, "<->",
    stroke: tokens.stroke-default + palette.ink-muted,
    label-fill: palette.surface,
    label-sep: tokens.label-sep,
    text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.ink, "identity + cache"),
  ),
  sig(<page>, <rules>, "read / write"),
  sig(<rules>, <store>, "allowed"),
  edge(<store>, <page>, "->",
    stroke: tokens.stroke-emphasis + palette.green.stroke,
    label-fill: palette.surface,
    label-sep: tokens.label-sep,
    bend: 34deg,
    text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.green.ink,
      "live updates, no reload"),
  ),
  edge(<store>, <others>, "<->",
    stroke: tokens.stroke-emphasis + palette.green.stroke,
    label-fill: palette.surface,
    label-sep: tokens.label-sep,
    text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.green.ink, "same connection"),
  ),
)

#v(tokens.gap-cell)

#align(center, block(width: 720pt, text(
  size: tokens.size-caption, fill: palette.ink-muted, style: "italic",
  "Green edges are the realtime path: a tap writes to Firestore, and every "
  + "other phone's open listener receives it within about a second. GitHub and "
  + "Firestore never talk to each other - GitHub serves code, Firestore holds "
  + "data, and the page in the middle is the only thing that touches both.",
)))
