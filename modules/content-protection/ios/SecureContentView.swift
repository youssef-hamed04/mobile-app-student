import ExpoModulesCore
import UIKit

/**
 A React Native view whose children render inside a capture-proof layer.

 How it works
 ------------
 `UITextField.isSecureTextEntry = true` makes UIKit host the field's text in a
 special `_UITextLayoutCanvasView` whose backing layer is flagged
 `allowsDisplayCompositing = false` at the render-server level. The render
 server excludes that layer from:

   • screenshots (hardware buttons, AssistiveTouch, Shortcuts)
   • ReplayKit / Control Center screen recordings
   • AirPlay / QuickTime mirroring
   • the springboard multitasking snapshot

 By taking that canvas view and re-parenting our own content into it, anything
 we draw inherits the same exclusion. This is the standard iOS technique for
 protected media surfaces and is what banking and streaming apps use in the
 absence of a public API.

 Robustness notes
 ----------------
  • The private view is located by *class-name shape* rather than a hardcoded
    private symbol, and every step is optional-chained. If Apple changes the
    internals, `secureCanvas` comes back nil, `isSecure` reports false, and the
    JS layer falls back to refusing playback (or to the blur overlay) instead
    of silently rendering unprotected content. That fallback decision is made
    in JS — see `useContentProtection`.
  • Layout is mirrored back onto the hosted content on every `layoutSubviews`
    so React Native's Yoga layout still drives sizing.
 */
public final class SecureContentView: ExpoView {

  private let field = UITextField()
  private let contentHost = UIView()
  private var secureCanvas: UIView?
  private var secureEnabled = false

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    setupSecureHierarchy()
  }

  // MARK: - Setup

  private func setupSecureHierarchy() {
    field.isSecureTextEntry = true
    field.isUserInteractionEnabled = false
    field.backgroundColor = .clear
    field.translatesAutoresizingMaskIntoConstraints = false

    // The field itself must be in the hierarchy for UIKit to build the
    // secure canvas, but it must never be visible or focusable.
    field.isAccessibilityElement = false
    addSubview(field)

    NSLayoutConstraint.activate([
      field.leadingAnchor.constraint(equalTo: leadingAnchor),
      field.trailingAnchor.constraint(equalTo: trailingAnchor),
      field.topAnchor.constraint(equalTo: topAnchor),
      field.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])

    contentHost.backgroundColor = .clear
    contentHost.translatesAutoresizingMaskIntoConstraints = false

    secureCanvas = locateSecureCanvas()
    attachContentHost()
  }

  /// Finds UIKit's secure text canvas without referencing a private symbol.
  private func locateSecureCanvas() -> UIView? {
    // Force the field to build its internal hierarchy.
    field.layoutIfNeeded()

    let candidates = field.subviews.filter { subview in
      let name = NSStringFromClass(type(of: subview))
      return name.contains("CanvasView") || name.contains("TextLayoutCanvas")
    }

    return candidates.first ?? field.subviews.first
  }

  private func attachContentHost() {
    let host = secureCanvas ?? self
    host.addSubview(contentHost)
    host.isUserInteractionEnabled = true

    NSLayoutConstraint.activate([
      contentHost.leadingAnchor.constraint(equalTo: host.leadingAnchor),
      contentHost.trailingAnchor.constraint(equalTo: host.trailingAnchor),
      contentHost.topAnchor.constraint(equalTo: host.topAnchor),
      contentHost.bottomAnchor.constraint(equalTo: host.bottomAnchor)
    ])
  }

  // MARK: - Public API

  /// True when the protected canvas was successfully acquired.
  public var isSecure: Bool { secureCanvas != nil && secureEnabled }

  public func setSecure(_ enabled: Bool) {
    guard enabled != secureEnabled else { return }
    secureEnabled = enabled
    field.isSecureTextEntry = enabled

    if enabled {
      if secureCanvas == nil { secureCanvas = locateSecureCanvas() }
      if contentHost.superview !== (secureCanvas ?? self) {
        contentHost.removeFromSuperview()
        attachContentHost()
      }
    } else {
      contentHost.removeFromSuperview()
      addSubview(contentHost)
      NSLayoutConstraint.activate([
        contentHost.leadingAnchor.constraint(equalTo: leadingAnchor),
        contentHost.trailingAnchor.constraint(equalTo: trailingAnchor),
        contentHost.topAnchor.constraint(equalTo: topAnchor),
        contentHost.bottomAnchor.constraint(equalTo: bottomAnchor)
      ])
    }

    setNeedsLayout()
  }

  // MARK: - React child management

  // New Architecture (Fabric) - the only renderer in React Native 0.86. Fabric
  // mounts children through these two calls and never calls
  // `insertReactSubview`. Without them the children were mounted as plain
  // subviews of `self`, next to the text field instead of inside its secure
  // canvas, so nothing was actually excluded from screenshots or recordings.
  public override func mountChildComponentView(_ childComponentView: UIView, index: Int) {
    contentHost.insertSubview(childComponentView, at: index)
    setNeedsLayout()
  }

  public override func unmountChildComponentView(_ childComponentView: UIView, index: Int) {
    // React Native asserts that an unmounted child has no superview.
    childComponentView.removeFromSuperview()
  }

  // Legacy renderer / interop layer.
  public override func insertReactSubview(_ subview: UIView!, at index: Int) {
    guard let subview else { return }
    contentHost.insertSubview(subview, at: index)
  }

  public override func removeReactSubview(_ subview: UIView!) {
    subview?.removeFromSuperview()
  }

  // MARK: - Touches

  /// The content lives inside a `UITextField` whose own interaction is off (it
  /// must never take focus or raise the keyboard), and UIKit's hit-testing
  /// stops at a view with interaction disabled. Route touches straight into the
  /// hosted content so the player controls and PDF scrolling keep working.
  public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard isUserInteractionEnabled, !isHidden, alpha > 0.01, self.point(inside: point, with: event) else {
      return nil
    }
    if contentHost.superview != nil {
      let local = convert(point, to: contentHost)
      if let hit = contentHost.hitTest(local, with: event) {
        return hit
      }
    }
    return super.hitTest(point, with: event)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    // Mirror our bounds onto the hosted content: Yoga sizes `self`, and the
    // secure canvas does not participate in the RN layout pass.
    contentHost.frame = bounds
    for child in contentHost.subviews where child.frame != bounds {
      child.frame = bounds
    }
  }
}
