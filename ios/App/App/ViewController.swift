import UIKit
import Capacitor

// The web view's own background shows wherever the page is not: behind the
// status bar's scroll-edge fade on iOS 26, and when the page is pulled past
// its end. Capacitor paints it the one color from capacitor.config.json, the
// website's light ground, so in dark mode a light haze sat under the status
// bar. This repaints it with the page's --ground for the current appearance,
// as a plain color (the edge fade resolves a dynamic one light), once the
// view has its traits and again whenever the appearance changes.
class ViewController: CAPBridgeViewController {
    private static func ground(_ traits: UITraitCollection) -> UIColor {
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x12 / 255.0, green: 0x16 / 255.0, blue: 0x0F / 255.0, alpha: 1)
            : UIColor(red: 0xF3 / 255.0, green: 0xF5 / 255.0, blue: 0xF0 / 255.0, alpha: 1)
    }

    private func paintGround() {
        let color = Self.ground(traitCollection)
        webView?.backgroundColor = color
        webView?.scrollView.backgroundColor = color
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if #available(iOS 17.0, *) {
            registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (vc: Self, _: UITraitCollection) in
                vc.paintGround()
            }
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        paintGround()
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        if #unavailable(iOS 17.0) { paintGround() }
    }
}
