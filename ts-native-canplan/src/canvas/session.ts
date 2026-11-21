import * as SecureStore from 'expo-secure-store';
import CanvasCookies from '../../modules/canvas-cookies';
import type { CanvasCourse, CanvasUser } from './types';

export const CANVAS_HOST = 'canvas.nus.edu.sg';
export const CANVAS_BASE = `https://${CANVAS_HOST}`;
export const LOGIN_URL = `${CANVAS_BASE}/login`;

const KEY_COOKIE = 'canvas-session-cookie';
const KEY_SAVED_AT = 'canvas-session-saved-at';

export class CanvasHTTPError extends Error {
  constructor(public status: number) {
    super(status === 401 ? 'Canvas rejected the session (401).' : `Canvas returned HTTP ${status}.`);
  }
}

/**
 * The Canvas session cookie lives only in the Keychain (iOS) / Keystore-backed storage (Android).
 * After login the WebView's own cookies are wiped, so a working session after relaunch proves the secure store.
 */
let cookieHeader: string | null = null;

export async function loadSavedSession(): Promise<{ cookie: string; savedAt: string | null } | null> {
  const cookie = await SecureStore.getItemAsync(KEY_COOKIE);
  if (!cookie) return null;
  cookieHeader = cookie;
  return { cookie, savedAt: await SecureStore.getItemAsync(KEY_SAVED_AT) };
}

/** Called after each WebView navigation. Returns the user when the WebView now holds a working Canvas session. */
export async function tryAdoptWebViewSession(): Promise<CanvasUser | null> {
  const header = await CanvasCookies.getCookieHeader(CANVAS_BASE);
  if (!header.includes('canvas_session=')) return null;
  cookieHeader = header;
  try {
    const user = await apiGet<CanvasUser>('/api/v1/users/self');
    await SecureStore.setItemAsync(KEY_COOKIE, header);
    await SecureStore.setItemAsync(KEY_SAVED_AT, new Date().toISOString());
    await CanvasCookies.clearAll();
    return user;
  } catch {
    cookieHeader = null;
    return null;
  }
}

export async function signOut() {
  cookieHeader = null;
  await SecureStore.deleteItemAsync(KEY_COOKIE);
  await SecureStore.deleteItemAsync(KEY_SAVED_AT);
  await CanvasCookies.clearAll();
}

async function rawFetch(url: string): Promise<Response> {
  if (!cookieHeader) throw new CanvasHTTPError(401);
  return fetch(url, {
    headers: { Accept: 'application/json', Cookie: cookieHeader },
    // Keep the platform cookie jar out of it: the secure store is the only session source.
    credentials: 'omit',
  });
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new CanvasHTTPError(res.status);
  // Canvas prefixes JSON with "while(1);" when a session cookie authenticates the request.
  const text = (await res.text()).replace(/^while\(1\);/, '');
  return JSON.parse(text) as T;
}

const absolute = (path: string) => (path.startsWith('http') ? path : `${CANVAS_BASE}${path}`);

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await rawFetch(absolute(path)));
}

/** Follows Canvas's `Link: <…>; rel="next"` pagination, up to 20 pages. */
export async function apiGetAll<T>(path: string): Promise<T[]> {
  let next: string | null = absolute(path);
  const all: T[] = [];
  for (let page = 0; next && page < 20; page++) {
    const res = await rawFetch(next);
    all.push(...(await parse<T[]>(res)));
    next = nextLink(res.headers.get('link'));
  }
  return all;
}

function nextLink(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(',')) {
    if (part.includes('rel="next"')) {
      const m = part.match(/<([^>]+)>/);
      if (m) return m[1];
    }
  }
  return null;
}

export const fetchUser = () => apiGet<CanvasUser>('/api/v1/users/self');
export const fetchCourses = () =>
  apiGetAll<CanvasCourse>('/api/v1/courses?enrollment_state=active&include[]=term&per_page=100');

/** A page's HTML body. Page lists don't include bodies, so the reader fetches them when opened. */
export const fetchPageBody = async (courseID: number, slug: string) =>
  (await apiGet<{ body?: string | null }>(`/api/v1/courses/${courseID}/pages/${encodeURIComponent(slug)}`)).body ?? '';

/** One file's metadata. Used for module items whose course locks the Files tab. May still be refused (403). */
export const fetchFile = (courseID: number, fileID: number) =>
  apiGet<{ id: number; display_name: string; url?: string; size?: number; modified_at?: string | null; 'content-type'?: string }>(
    `/api/v1/courses/${courseID}/files/${fileID}`,
  );
