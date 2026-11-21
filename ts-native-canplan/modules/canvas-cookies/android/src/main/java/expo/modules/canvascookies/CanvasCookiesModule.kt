package expo.modules.canvascookies

import android.webkit.CookieManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Reads the Android WebView cookie jar, which includes HttpOnly cookies like canvas_session. */
class CanvasCookiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CanvasCookies")

    AsyncFunction("getCookieHeader") { url: String ->
      CookieManager.getInstance().getCookie(url) ?: ""
    }

    AsyncFunction("clearAll") { promise: Promise ->
      val cm = CookieManager.getInstance()
      cm.removeAllCookies { cm.flush(); promise.resolve(null) }
    }.runOnQueue(Queues.MAIN)
  }
}
