// Home-screen icon: a pot on the app's enamel green.
//
// Page size is in pt and compiled at 72 ppi, so 1pt == 1px and --input size
// gives an exact pixel square. The pot sits at 62% of the square, which keeps
// it inside the safe zone Android crops to for maskable icons and inside the
// rounded-square mask iOS applies.

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

#set text(font: ("Segoe UI Emoji", "Apple Color Emoji"), size: size * scale * 1pt)

#align(center + horizon)[🍲]
