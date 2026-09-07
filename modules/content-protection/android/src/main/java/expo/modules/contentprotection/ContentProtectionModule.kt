package expo.modules.contentprotection

import android.app.Activity
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import android.view.WindowManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.Executor

/**
 * Android content protection.
 *
 * Layers implemented here:
 *
 *  1. FLAG_SECURE — the platform-level guarantee. Blocks screenshots, blanks
 *     the window in screen recordings and in the recents/overview thumbnail,
 *     and prevents the surface from being mirrored to non-secure displays.
 *     Applied at MainActivity.onCreate by the config plugin, and toggled per
 *     screen from JS.
 *
 *  2. Screen-capture callback (API 34+) — fires when the user takes a
 *     screenshot *of this activity*. Even though FLAG_SECURE already blanks
 *     the result, the callback lets us stop playback and report the attempt
 *     to the backend for the audit trail.
 *
 *  3. Screen-recording callback (API 35+) — fires when a recording of this
 *     app starts or stops, so playback can be halted for the duration.
 *
 *  4. External / mirrored display detection — protected playback is refused
 *     while a non-secure presentation display (cast, HDMI capture card) is
 *     attached.
 *
 *  5. Coarse integrity probe — root artefacts and debugger attachment. This
 *     is a *signal* reported to the backend, never a client-side verdict.
 */
class ContentProtectionModule : Module() {

  companion object {
    const val EVENT_CAPTURE = "onScreenCaptured"
    const val EVENT_RECORDING = "onScreenRecordingChanged"
    const val EVENT_DISPLAY = "onExternalDisplayChanged"
  }

  private val activity: Activity?
    get() = appContext.activityProvider?.currentActivity

  private val ctx: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private var captureCallback: Any? = null
  private var recordingCallback: Any? = null
  private var displayListener: DisplayManager.DisplayListener? = null
  private var secureEnabled = true

  private val mainExecutor: Executor
    get() = ctx.mainExecutor

  override fun definition() = ModuleDefinition {
    Name("ContentProtection")

    Events(EVENT_CAPTURE, EVENT_RECORDING, EVENT_DISPLAY)

    Constants {
      mapOf(
        "isSupported" to true,
        "platform" to "android",
        "supportsSecureFlag" to true,
        "supportsCaptureDetection" to (Build.VERSION.SDK_INT >= 34),
        "supportsRecordingDetection" to (Build.VERSION.SDK_INT >= 35),
        "supportsSecureSurface" to true,
        "sdkInt" to Build.VERSION.SDK_INT
      )
    }

    // ---------------------------------------------------------------------
    // FLAG_SECURE
    // ---------------------------------------------------------------------

    AsyncFunction("setSecureFlag") { enabled: Boolean, promise: Promise ->
      val act = activity
      if (act == null) {
        promise.reject("E_NO_ACTIVITY", "No current activity", null)
        return@AsyncFunction
      }
      act.runOnUiThread {
        if (enabled) {
          act.window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
          )
        } else {
          act.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        secureEnabled = enabled
        promise.resolve(enabled)
      }
    }

    Function("isSecureFlagEnabled") {
      val flags = activity?.window?.attributes?.flags ?: 0
      (flags and WindowManager.LayoutParams.FLAG_SECURE) != 0
    }

    // ---------------------------------------------------------------------
    // Detection
    // ---------------------------------------------------------------------

    AsyncFunction("startDetection") { promise: Promise ->
      registerCaptureCallback()
      registerRecordingCallback()
      registerDisplayListener()
      promise.resolve(null)
    }

    AsyncFunction("stopDetection") { promise: Promise ->
      unregisterCaptureCallback()
      unregisterRecordingCallback()
      unregisterDisplayListener()
      promise.resolve(null)
    }

    Function("isBeingRecorded") {
      // Android gives no direct "am I being recorded" query below API 35;
      // a non-secure mirrored display is the observable proxy.
      hasInsecureExternalDisplay()
    }

    Function("hasExternalDisplay") { hasInsecureExternalDisplay() }

    // ---------------------------------------------------------------------
    // Integrity signals
    // ---------------------------------------------------------------------

    Function("getIntegritySignals") {
      mapOf(
        "rooted" to looksRooted(),
        "debuggerAttached" to android.os.Debug.isDebuggerConnected(),
        "emulator" to looksLikeEmulator(),
        "developerModeOn" to isDeveloperModeEnabled(),
        "adbEnabled" to isAdbEnabled()
      )
    }

    // ---------------------------------------------------------------------
    // Secure rendering surface (native view)
    // ---------------------------------------------------------------------

    View(SecureContentView::class) {
      Prop("enabled") { view: SecureContentView, enabled: Boolean ->
        view.setSecure(enabled)
      }
    }

    OnActivityEntersForeground { if (secureEnabled) reapplySecureFlag() }

    OnDestroy {
      unregisterCaptureCallback()
      unregisterRecordingCallback()
      unregisterDisplayListener()
    }
  }

  // -----------------------------------------------------------------------
  // Implementation
  // -----------------------------------------------------------------------

  private fun reapplySecureFlag() {
    activity?.runOnUiThread {
      activity?.window?.setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
      )
    }
  }

  private fun registerCaptureCallback() {
    if (Build.VERSION.SDK_INT < 34 || captureCallback != null) return
    val act = activity ?: return

    val cb = Activity.ScreenCaptureCallback {
      sendEvent(EVENT_CAPTURE, mapOf("at" to System.currentTimeMillis()))
    }
    act.registerScreenCaptureCallback(mainExecutor, cb)
    captureCallback = cb
  }

  private fun unregisterCaptureCallback() {
    if (Build.VERSION.SDK_INT < 34) return
    val cb = captureCallback as? Activity.ScreenCaptureCallback ?: return
    runCatching { activity?.unregisterScreenCaptureCallback(cb) }
    captureCallback = null
  }

  private fun registerRecordingCallback() {
    if (Build.VERSION.SDK_INT < 35 || recordingCallback != null) return
    val act = activity ?: return

    val cb = java.util.function.Consumer<Int> { state ->
      // WindowManager.SCREEN_RECORDING_STATE_VISIBLE == 1
      sendEvent(EVENT_RECORDING, mapOf("recording" to (state == 1)))
    }

    runCatching {
      val wm = act.getSystemService(WindowManager::class.java)
      val method = WindowManager::class.java.getMethod(
        "addScreenRecordingCallback",
        Executor::class.java,
        java.util.function.Consumer::class.java
      )
      method.invoke(wm, mainExecutor, cb)
      recordingCallback = cb
    }
  }

  private fun unregisterRecordingCallback() {
    if (Build.VERSION.SDK_INT < 35) return
    val cb = recordingCallback ?: return
    runCatching {
      val wm = activity?.getSystemService(WindowManager::class.java)
      val method = WindowManager::class.java.getMethod(
        "removeScreenRecordingCallback",
        java.util.function.Consumer::class.java
      )
      method.invoke(wm, cb)
    }
    recordingCallback = null
  }

  private fun registerDisplayListener() {
    if (displayListener != null) return
    val dm = ctx.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager

    val listener = object : DisplayManager.DisplayListener {
      private fun notifyChange() =
        sendEvent(EVENT_DISPLAY, mapOf("external" to hasInsecureExternalDisplay()))

      override fun onDisplayAdded(displayId: Int) = notifyChange()
      override fun onDisplayRemoved(displayId: Int) = notifyChange()
      override fun onDisplayChanged(displayId: Int) = notifyChange()
    }

    dm.registerDisplayListener(listener, null)
    displayListener = listener
  }

  private fun unregisterDisplayListener() {
    val listener = displayListener ?: return
    val dm = ctx.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    runCatching { dm.unregisterDisplayListener(listener) }
    displayListener = null
  }

  /** True when a display other than the built-in one is presenting content. */
  private fun hasInsecureExternalDisplay(): Boolean {
    val dm = ctx.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    return dm.displays.any { d ->
      d.displayId != Display.DEFAULT_DISPLAY &&
        (d.flags and Display.FLAG_SECURE) == 0 &&
        (d.flags and Display.FLAG_PRESENTATION) != 0
    }
  }

  private val ROOT_PATHS = arrayOf(
    "/system/app/Superuser.apk",
    "/sbin/su",
    "/system/bin/su",
    "/system/xbin/su",
    "/data/local/xbin/su",
    "/data/local/bin/su",
    "/system/sd/xbin/su",
    "/system/bin/failsafe/su",
    "/data/local/su",
    "/su/bin/su",
    "/system/bin/magisk",
    "/sbin/magisk"
  )

  private fun looksRooted(): Boolean {
    if (Build.TAGS?.contains("test-keys") == true) return true
    return ROOT_PATHS.any { runCatching { File(it).exists() }.getOrDefault(false) }
  }

  private fun looksLikeEmulator(): Boolean {
    val fingerprint = Build.FINGERPRINT ?: ""
    val model = Build.MODEL ?: ""
    val product = Build.PRODUCT ?: ""
    return fingerprint.startsWith("generic") ||
      fingerprint.contains("vbox") ||
      fingerprint.contains("emulator") ||
      model.contains("Emulator") ||
      model.contains("Android SDK built for") ||
      product.contains("sdk_gphone") ||
      Build.HARDWARE?.contains("goldfish") == true ||
      Build.HARDWARE?.contains("ranchu") == true
  }

  private fun isDeveloperModeEnabled(): Boolean = runCatching {
    android.provider.Settings.Global.getInt(
      ctx.contentResolver,
      android.provider.Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
      0
    ) != 0
  }.getOrDefault(false)

  private fun isAdbEnabled(): Boolean = runCatching {
    android.provider.Settings.Global.getInt(
      ctx.contentResolver,
      android.provider.Settings.Global.ADB_ENABLED,
      0
    ) != 0
  }.getOrDefault(false)
}
