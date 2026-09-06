// Home-screen icon: a pot on the app's enamel green.
//
// Page size is in pt and compiled at 72 ppi, so 1pt == 1px and --input size
// gives an exact pixel square. The pot sits at 62% of the square, which keeps
// it inside the safe zone Android crops to for maskable icons and inside the
// rounded-square mask iOS applies.

#let size = float(sys.inputs.at("size", default: "512"))

#set page(
  width: size * 1pt,
  height: size * 1pt,
  margin: 0pt,
  fill: rgb("#176B4B"),
)

#set text(font: ("Segoe UI Emoji", "Apple Color Emoji"), size: size * 0.62 * 1pt)

#align(center + horizon)[🍲]
