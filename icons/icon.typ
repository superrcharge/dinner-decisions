// Home-screen icon: a pot on the app's enamel green.
//
// Page size is in pt and compiled at 72 ppi, so 1pt == 1px and --input size
// gives an exact pixel square. The pot sits at 62% of the square, which keeps
// it inside the safe zone Android crops to for maskable icons and inside the
// rounded-square mask iOS applies.
//
// The pot is pot.svg, Microsoft's Fluent Emoji "Pot of food" under the MIT
// License (pot-LICENSE.txt): the same drawing Windows' emoji font shows, but
// as a file we may ship, so the icon needs no font and carries no font
// licence question in the app stores.
//
// The store apps reuse it (icons/render-app-assets.sh) with two more inputs:
// bg=none for the transparent front layer of Android's adaptive icon, and a
// smaller scale for that layer and for the splash screens.

#let size = float(sys.inputs.at("size", default: "512"))
#let scale = float(sys.inputs.at("scale", default: "0.62"))
#let bg = sys.inputs.at("bg", default: "#176B4B")

#set page(
  width: size * 1pt,
  height: size * 1pt,
  margin: 0pt,
  fill: if bg == "none" { none } else { rgb(bg) },
)

// `scale` was first measured as the emoji font's size; the SVG has more
// space around the pot, so 1.12 times that width draws the same pot.
#if scale > 0 {
  align(center + horizon, image("pot.svg", width: size * scale * 1.12 * 1pt))
}
