// GitHub Primer palette, color-anchored. Hues are named by color, never by
// domain meaning - each diagram picks a hue for the visual weight it needs.
//
// Theme is chosen at compile time: typst compile --input theme=dark ...

#let _hue(stroke: black, fill: white, ink: black) = (
  stroke: stroke,
  fill: fill,
  ink: ink,
  divider: color.mix((fill, 50%), (stroke, 50%)),
)

#let _light = (
  blue:   _hue(stroke: rgb("#0969DA"), fill: rgb("#DDF4FF"), ink: rgb("#033D8B")),
  green:  _hue(stroke: rgb("#1A7F37"), fill: rgb("#DAFBE1"), ink: rgb("#044F1E")),
  yellow: _hue(stroke: rgb("#9A6700"), fill: rgb("#FFF8C5"), ink: rgb("#633C01")),
  orange: _hue(stroke: rgb("#BC4C00"), fill: rgb("#FFF1E5"), ink: rgb("#762C00")),
  red:    _hue(stroke: rgb("#CF222E"), fill: rgb("#FFEBE9"), ink: rgb("#82071E")),
  purple: _hue(stroke: rgb("#8250DF"), fill: rgb("#FBEFFF"), ink: rgb("#512A97")),
  pink:   _hue(stroke: rgb("#BF3989"), fill: rgb("#FFEFF7"), ink: rgb("#772057")),
  coral:  _hue(stroke: rgb("#C4432B"), fill: rgb("#FFF0EB"), ink: rgb("#801F0F")),

  surface:          rgb("#FFFFFF"),
  surface-muted:    rgb("#F6F8FA"),
  surface-raised:   rgb("#EFF2F5"),
  surface-emphasis: rgb("#E6EAEF"),
  ink:              rgb("#1F2328"),
  ink-muted:        rgb("#59636E"),
  ink-subtle:       rgb("#818B98"),
  border:           rgb("#D1D9E0"),
  border-muted:     rgb("#DAE0E7"),
)

#let _dark = (
  blue:   _hue(stroke: rgb("#388BFD"), fill: rgb("#051D4D"), ink: rgb("#80CCFF")),
  green:  _hue(stroke: rgb("#3FB950"), fill: rgb("#003D16"), ink: rgb("#6FDD8B")),
  yellow: _hue(stroke: rgb("#D29922"), fill: rgb("#4D2D00"), ink: rgb("#EAC54F")),
  orange: _hue(stroke: rgb("#DB6D28"), fill: rgb("#3D1300"), ink: rgb("#FFB77C")),
  red:    _hue(stroke: rgb("#F85149"), fill: rgb("#660018"), ink: rgb("#FFABA8")),
  purple: _hue(stroke: rgb("#AB7DF8"), fill: rgb("#271052"), ink: rgb("#D8B9FF")),
  pink:   _hue(stroke: rgb("#FF80C8"), fill: rgb("#611347"), ink: rgb("#FFADDA")),
  coral:  _hue(stroke: rgb("#FD8C73"), fill: rgb("#691105"), ink: rgb("#FFB4A1")),

  surface:          rgb("#0D1117"),
  surface-muted:    rgb("#151B23"),
  surface-raised:   rgb("#010409"),
  surface-emphasis: rgb("#212830"),
  ink:              rgb("#F0F6FC"),
  ink-muted:        rgb("#9198A1"),
  ink-subtle:       rgb("#656C76"),
  border:           rgb("#3D444D"),
  border-muted:     rgb("#2F3742"),
)

#let palette = if sys.inputs.at("theme", default: "light") == "dark" { _dark } else { _light }
