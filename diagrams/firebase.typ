#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import "design/tokens.typ": tokens
#import "design/theme.typ": palette

#set page(width: auto, height: auto, margin: 14pt, fill: palette.surface)
#set text(font: tokens.font, fill: palette.ink, size: tokens.size-body)

#let card(glyph, title, kind, desc, hue, w: 168pt) = block(
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

#let box-node(pos, glyph, title, kind, desc, hue, name, weight: tokens.stroke-default) = node(
  pos,
  card(glyph, title, kind, desc, hue),
  shape: fletcher.shapes.rect,
  fill: hue.fill,
  stroke: weight + hue.stroke,
  corner-radius: tokens.radius-shape,
  inset: tokens.pad-inside-shape,
  name: name,
)

// A collection inside the store. The document-id shape is the second line
// because that is where the meaning sits in this data model.
#let coll(pos, name-str, docid, desc, name) = node(
  pos,
  block(
    width: 186pt,
    stack(
      dir: ttb,
      spacing: tokens.gap-structured-text,
      block(width: 100%, align(center, text(
        size: tokens.size-body, weight: tokens.weight-bold,
        fill: palette.green.ink, name-str,
      ))),
      block(width: 100%, align(center, text(
        size: tokens.size-label, fill: palette.green.ink.lighten(18%), docid,
      ))),
      line(length: 100%, stroke: 0.6pt + palette.green.divider),
      block(width: 100%, align(left, text(
        size: tokens.size-caption, fill: palette.green.ink, desc,
      ))),
    ),
  ),
  shape: fletcher.shapes.rect,
  fill: palette.surface,
  stroke: tokens.stroke-thin + palette.green.stroke,
  corner-radius: tokens.radius-shape,
  inset: tokens.pad-inside-shape,
  name: name,
)

#align(center, text(size: tokens.size-heading, weight: tokens.weight-bold,
  "What lives in Firebase"))

#v(tokens.gap-cell)

#diagram(
  spacing: (tokens.space-between-shapes * 2.9, tokens.space-between-ranks * 0.8),

  box-node((0, 0), "\u{F084}", "Anonymous Auth", "identity",
    "Every visitor is signed in silently on first load and handed a token. "
    + "Nobody creates an account; each device gets its own id.",
    palette.yellow, <auth>),

  box-node((0, 1), "\u{F023}", "Security rules", "gate",
    "Every read and write passes through. Rejects anyone unauthenticated, and "
    + "any collection outside the five here.",
    palette.red, <rules>, weight: tokens.stroke-emphasis),

  // Title for the enclosure. Fletcher errors on shape: none, so an invisible
  // rect carries the label and joins the enclose list.
  node((1.5, -1),
    text(size: tokens.size-title, weight: tokens.weight-bold, fill: palette.green.ink,
      "\u{F1C0}  Cloud Firestore"),
    shape: fletcher.shapes.rect,
    fill: none,
    stroke: none,
    name: <storetitle>),

  coll((1, 0), "meals", "id: slug of the name",
    "The curated master list. An optional icon field overrides the emoji the "
    + "app would otherwise pick from the name.", <meals>),

  coll((2, 0), "suggestions", "id: the slug its meal will take",
    "Typed in by anyone, waiting to be kept or dismissed. Sharing the id means "
    + "approving one keeps existing votes pointing at the right meal.", <sugg>),

  coll((1, 1), "people", "id: slug + random suffix",
    "The household roster. Which name a phone is picking as is remembered on "
    + "that device, not here.", <people>),

  coll((2, 1), "votes", "id: <weekId>__<personId>",
    "One document per person per week, holding an array of meal ids. One doc "
    + "per voter means two phones never contend on the same write.", <votes>),

  coll((1, 2), "weeks", "id: <weekId>",
    "The meals locked into that week's plan. weekId is the Sunday, as "
    + "YYYY-MM-DD, so the week rolls over on its own.", <weeks>),

  node(
    enclose: (<storetitle>, <meals>, <sugg>, <people>, <votes>, <weeks>),
    inset: tokens.pad-inside-container,
    stroke: tokens.stroke-default + palette.green.stroke,
    fill: palette.green.fill,
    corner-radius: tokens.radius-container,
    snap: -1,
    name: <store>,
  ),

  edge(<auth>, <rules>, "->",
    stroke: tokens.stroke-default + palette.ink-muted,
    label-fill: palette.surface,
    label-sep: tokens.label-sep,
    text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.ink, "token"),
  ),

  edge(<rules>, <store>, "->",
    stroke: tokens.stroke-emphasis + palette.green.stroke,
    label-fill: palette.surface,
    label-sep: tokens.label-sep,
    text(size: tokens.label-size, weight: tokens.weight-bold, fill: palette.green.ink, "allowed"),
  ),
)

#v(tokens.gap-cell)

#align(center, block(width: 690pt, stack(
  dir: ttb,
  spacing: 7pt,
  text(size: tokens.size-caption, fill: palette.ink-muted, style: "italic",
    "Firestore and Anonymous Authentication are the only Firebase products "
    + "switched on. GitHub Pages serves the app, so Firebase Hosting and "
    + "Functions stay off. The free tier allows 1 GiB of storage, 50,000 reads "
    + "and 20,000 writes a day - a household of five voting weekly is nowhere "
    + "near it."),
  text(size: tokens.size-caption, fill: palette.ink-muted, style: "italic",
    "In the rules, create/update and delete are written as separate clauses on "
    + "purpose: a delete carries no request.resource, so a single combined rule "
    + "with a field check silently blocks every delete. The rules live in "
    + "firestore.rules, but nothing deploys them - they take effect only when "
    + "pasted into the Firebase console."),
)))
