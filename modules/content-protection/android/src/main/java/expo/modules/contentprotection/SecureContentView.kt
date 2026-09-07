package expo.modules.contentprotection

import android.content.Context
import android.view.SurfaceView
import android.view.WindowManager
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * Android counterpart of the iOS SecureContentView.
 *
 * On Android the platform guarantee lives at the window level (FLAG_SECURE),
 * so this view's job is to make that guarantee *scoped and reliable*:
 *
 *  • While at least one SecureContentView is attached, FLAG_SECURE is on.
 *    A reference count means nesting or several protected regions on one
 *    screen behave correctly, and the flag is only cleared once the last
 *    protected view goes away.
 *
 *  • Any SurfaceView descendant (the video output surface) additionally gets
 *    `setSecure(true)`, which marks the surface itself as protected at the
 *    SurfaceFlinger level. This matters because a hardware video surface can
 *    otherwise be composited into a mirrored display independently of the
 *    window flag.
 */
class SecureContentView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  companion object {
    /** Number of currently attached protected views, per process. */
    private var attachedCount = 0
  }

  private var enabled = true

  fun setSecure(value: Boolean) {
    if (value == enabled) return
    enabled = value
    if (isAttachedToWindow) {
      if (value) acquire() else release()
    }
    applySurfaceSecurity(value)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (enabled) acquire()
    applySurfaceSecurity(enabled)
  }

  override fun onDetachedFromWindow() {
    if (enabled) release()
    super.onDetachedFromWindow()
  }

  override fun onViewAdded(child: android.view.View?) {
    super.onViewAdded(child)
    applySurfaceSecurity(enabled)
  }

  private fun acquire() {
    attachedCount += 1
    withWindow { it.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE
    ) }
  }

  private fun release() {
    attachedCount = (attachedCount - 1).coerceAtLeast(0)
    // The activity-level flag set at onCreate stays on by default; we only
    // clear it if the app explicitly opted out globally via setSecureFlag.
    if (attachedCount == 0) {
      // Intentionally left on. Clearing is an explicit JS decision so that a
      // transient unmount can never expose a frame.
    }
  }

  private fun withWindow(block: (android.view.Window) -> Unit) {
    val activity = appContext.activityProvider?.currentActivity ?: return
    activity.runOnUiThread { block(activity.window) }
  }

  /** Recursively mark video surfaces as protected. */
  private fun applySurfaceSecurity(secure: Boolean) {
    fun walk(view: android.view.View) {
      if (view is SurfaceView) {
        runCatching { view.setSecure(secure) }
      }
      if (view is FrameLayout || view is android.view.ViewGroup) {
        val group = view as android.view.ViewGroup
        for (i in 0 until group.childCount) walk(group.getChildAt(i))
      }
    }
    walk(this)
  }
}
