import ExpoModulesCore
import WebKit

/// Reads the WKWebView cookie store, which JavaScript cannot see for HttpOnly cookies like canvas_session.
public class CanvasCookiesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CanvasCookies")

    AsyncFunction("getCookieHeader") { (url: String, promise: Promise) in
      guard let host = URL(string: url)?.host else { promise.resolve(""); return }
      DispatchQueue.main.async {
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
          let matching = cookies.filter { c in
            let d = c.domain.hasPrefix(".") ? String(c.domain.dropFirst()) : c.domain
            return host == d || host.hasSuffix("." + d)
          }
          promise.resolve(matching.map { "\($0.name)=\($0.value)" }.joined(separator: "; "))
        }
      }
    }

    AsyncFunction("clearAll") { (promise: Promise) in
      DispatchQueue.main.async {
        WKWebsiteDataStore.default().removeData(
          ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast
        ) { promise.resolve(nil) }
      }
    }
  }
}
