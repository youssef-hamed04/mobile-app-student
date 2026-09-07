import ExpoModulesCore
import UIKit

/**
 iOS content protection.

 iOS gives no equivalent of Android's FLAG_SECURE, so protection is assembled
 from four mechanisms:

  1. **Secure rendering surface** (`SecureContentView`). A `UITextField` with
     `isSecureTextEntry = true` owns a layer that the render server refuses to
     include in screenshots, screen recordings, AirPlay mirroring and the
     multitasking snapshot. Re-parenting our content into that layer makes the
     protected region come out blank in any capture, which is the closest iOS
     analogue to FLAG_SECURE. Everything else on screen still renders normally.

  2. **Live capture state** (`UIScreen.isCaptured`), observed via KVO. True
     while the screen is being recorded or mirrored — playback is halted for
     the duration and the JS layer is notified.

  3. **Screenshot notification** (`userDidTakeScreenshotNotification`). Fires
     *after* the shutter; with (1) in place the captured image is already
     blank, but the event is still reported so the backend can log the attempt
     against the account.

  4. **Privacy overlay on resign-active**, so the app switcher card and any
     background snapshot show a branded placeholder rather than lesson content.
 */
public class ContentProtectionModule: Module {

  private static let EVENT_CAPTURE = "onScreenCaptured"
  private static let EVENT_RECORDING = "onScreenRecordingChanged"
  private static let EVENT_DISPLAY = "onExternalDisplayChanged"

  private var capturedObservation: NSKeyValueObservation?
  private var screenshotObserver: NSObjectProtocol?
  private var resignObserver: NSObjectProtocol?
  private var activeObserver: NSObjectProtocol?
  private var displayConnectObserver: NSObjectProtocol?
  private var displayDisconnectObserver: NSObjectProtocol?

  private var privacyOverlay: UIView?
  private var secureFlagEnabled = false

  public func definition() -> ModuleDefinition {
    Name("ContentProtection")

    Events(
      ContentProtectionModule.EVENT_CAPTURE,
      ContentProtectionModule.EVENT_RECORDING,
      ContentProtectionModule.EVENT_DISPLAY
    )

    Constants {
      [
        "isSupported": true,
        "platform": "ios",
        // iOS has no window-level secure flag; the secure *surface* is the
        // equivalent capability, which is why this is reported separately.
        "supportsSecureFlag": false,
        "supportsCaptureDetection": true,
        "supportsRecordingDetection": true,
        "supportsSecureSurface": true,
        "systemVersion": UIDevice.current.systemVersion
      ]
    }

    // -----------------------------------------------------------------
    // "Secure flag" -> on iOS this toggles the privacy overlay behaviour
    // and marks the session as protected.
    // -----------------------------------------------------------------

    AsyncFunction("setSecureFlag") { (enabled: Bool, promise: Promise) in
      DispatchQueue.main.async {
        self.secureFlagEnabled = enabled
        if !enabled { self.hidePrivacyOverlay() }
        promise.resolve(enabled)
      }
    }

    Function("isSecureFlagEnabled") { self.secureFlagEnabled }

    // -----------------------------------------------------------------
    // Detection
    // -----------------------------------------------------------------

    AsyncFunction("startDetection") { (promise: Promise) in
      DispatchQueue.main.async {
        self.startObserving()
        promise.resolve(nil)
      }
    }

    AsyncFunction("stopDetection") { (promise: Promise) in
      DispatchQueue.main.async {
        self.stopObserving()
        promise.resolve(nil)
      }
    }

    Function("isBeingRecorded") { UIScreen.main.isCaptured }

    Function("hasExternalDisplay") { UIScreen.screens.count > 1 }

    Function("getIntegritySignals") {
      [
        "rooted": self.isJailbroken(),
        "debuggerAttached": self.isDebuggerAttached(),
        "emulator": self.isSimulator(),
        "developerModeOn": false,
        "adbEnabled": false
      ]
    }

    // -----------------------------------------------------------------
    // Secure rendering surface (native view)
    // -----------------------------------------------------------------

    View(SecureContentView.self) {
      Prop("enabled") { (view: SecureContentView, enabled: Bool) in
        view.setSecure(enabled)
      }
    }

    OnDestroy {
      self.stopObserving()
    }
  }

  // -------------------------------------------------------------------
  // Observation
  // -------------------------------------------------------------------

  private func startObserving() {
    guard capturedObservation == nil else { return }

    capturedObservation = UIScreen.main.observe(\.isCaptured, options: [.new]) {
      [weak self] screen, _ in
      self?.sendEvent(
        ContentProtectionModule.EVENT_RECORDING,
        ["recording": screen.isCaptured]
      )
    }

    screenshotObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.userDidTakeScreenshotNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.sendEvent(
        ContentProtectionModule.EVENT_CAPTURE,
        ["at": Date().timeIntervalSince1970 * 1000]
      )
    }

    resignObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willResignActiveNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self, self.secureFlagEnabled else { return }
      self.showPrivacyOverlay()
    }

    activeObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.hidePrivacyOverlay()
    }

    displayConnectObserver = NotificationCenter.default.addObserver(
      forName: UIScreen.didConnectNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.sendEvent(ContentProtectionModule.EVENT_DISPLAY, ["external": true])
    }

    displayDisconnectObserver = NotificationCenter.default.addObserver(
      forName: UIScreen.didDisconnectNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.sendEvent(
        ContentProtectionModule.EVENT_DISPLAY,
        ["external": UIScreen.screens.count > 1]
      )
    }

    // Emit the current state immediately so JS never starts from a stale
    // assumption (e.g. a recording that was already running).
    sendEvent(
      ContentProtectionModule.EVENT_RECORDING,
      ["recording": UIScreen.main.isCaptured]
    )
  }

  private func stopObserving() {
    capturedObservation?.invalidate()
    capturedObservation = nil

    let center = NotificationCenter.default
    [screenshotObserver, resignObserver, activeObserver,
     displayConnectObserver, displayDisconnectObserver]
      .compactMap { $0 }
      .forEach { center.removeObserver($0) }

    screenshotObserver = nil
    resignObserver = nil
    activeObserver = nil
    displayConnectObserver = nil
    displayDisconnectObserver = nil

    hidePrivacyOverlay()
  }

  // -------------------------------------------------------------------
  // Privacy overlay (app switcher / background snapshot)
  // -------------------------------------------------------------------

  private func showPrivacyOverlay() {
    guard privacyOverlay == nil,
          let window = keyWindow() else { return }

    let overlay = UIView(frame: window.bounds)
    overlay.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.051, alpha: 1)
    overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    overlay.tag = 0x5EC0

    let label = UILabel()
    label.text = "Protected content"
    label.textColor = UIColor(red: 0.949, green: 0.416, blue: 0.106, alpha: 1)
    label.font = .systemFont(ofSize: 16, weight: .semibold)
    label.translatesAutoresizingMaskIntoConstraints = false
    overlay.addSubview(label)

    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: overlay.centerYAnchor)
    ])

    window.addSubview(overlay)
    privacyOverlay = overlay
  }

  private func hidePrivacyOverlay() {
    privacyOverlay?.removeFromSuperview()
    privacyOverlay = nil
  }

  private func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  // -------------------------------------------------------------------
  // Integrity probes (signals only — the backend decides)
  // -------------------------------------------------------------------

  private func isSimulator() -> Bool {
    #if targetEnvironment(simulator)
      return true
    #else
      return false
    #endif
  }

  private func isDebuggerAttached() -> Bool {
    var info = kinfo_proc()
    var size = MemoryLayout<kinfo_proc>.stride
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
    guard result == 0 else { return false }
    return (info.kp_proc.p_flag & P_TRACED) != 0
  }

  private func isJailbroken() -> Bool {
    #if targetEnvironment(simulator)
      return false
    #else
      let paths = [
        "/Applications/Cydia.app",
        "/Applications/Sileo.app",
        "/Library/MobileSubstrate/MobileSubstrate.dylib",
        "/bin/bash",
        "/usr/sbin/sshd",
        "/etc/apt",
        "/private/var/lib/apt/"
      ]
      if paths.contains(where: { FileManager.default.fileExists(atPath: $0) }) {
        return true
      }
      // A sandboxed app cannot write outside its container.
      let probe = "/private/jailbreak-probe.txt"
      do {
        try "probe".write(toFile: probe, atomically: true, encoding: .utf8)
        try FileManager.default.removeItem(atPath: probe)
        return true
      } catch {
        return false
      }
    #endif
  }
}
