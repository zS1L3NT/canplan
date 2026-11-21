import { NativeModule, requireNativeModule } from 'expo';

declare class CanvasCookiesModule extends NativeModule<{}> {
  /** All cookies the system WebView holds for this URL, including HttpOnly ones, as a Cookie header value. */
  getCookieHeader(url: string): Promise<string>;
  /** Removes every cookie from the system WebView store. */
  clearAll(): Promise<void>;
}

export default requireNativeModule<CanvasCookiesModule>('CanvasCookies');
