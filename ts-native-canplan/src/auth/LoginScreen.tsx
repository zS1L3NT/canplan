import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { CANVAS_HOST, LOGIN_URL, tryAdoptWebViewSession } from '../canvas/session';
import type { CanvasUser } from '../canvas/types';

/** The normal NUS Canvas login (hCaptcha → NUS SSO) inside a WebView. */
export function LoginScreen({ reason, onSignedIn, onDemo }: { reason?: string; onSignedIn: (u: CanvasUser) => void; onDemo?: () => void }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const adopted = useRef(false);

  const onNav = async (nav: WebViewNavigation) => {
    if (adopted.current || nav.loading) return;
    let url: URL;
    try { url = new URL(nav.url); } catch { return; }
    console.log('[login] at', url.host + url.pathname);
    if (url.host !== CANVAS_HOST || url.pathname.startsWith('/login')) return;
    setChecking(true);
    const user = await tryAdoptWebViewSession();
    setChecking(false);
    if (user) {
      adopted.current = true;
      console.log('[login] session adopted and saved to secure store');
      setOpen(false);
      onSignedIn(user);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.center}>
        <Text style={s.title}>Canplan</Text>
        <Text style={s.body}>Sign in with your NUS account. Your session stays in this device&apos;s secure storage.</Text>
        {reason ? <Text style={s.reason}>{reason}</Text> : null}
      </View>
      <Pressable style={s.button} onPress={() => { adopted.current = false; setOpen(true); }} accessibilityRole="button">
        <Text style={s.buttonText}>Sign in to Canvas</Text>
      </Pressable>
      {__DEV__ && onDemo ? (
        <Pressable onPress={onDemo} accessibilityRole="button" style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text style={s.cancel}>Use demo data (dev only)</Text>
        </Pressable>
      ) : null}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={s.bar}>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button"><Text style={s.cancel}>Cancel</Text></Pressable>
            <Text style={s.barTitle}>NUS Canvas</Text>
            <View style={{ width: 60, alignItems: 'flex-end' }}>{checking ? <ActivityIndicator /> : null}</View>
          </View>
          <WebView
            source={{ uri: LOGIN_URL }}
            onNavigationStateChange={onNav}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: '#f5f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#16202c' },
  body: { fontSize: 16, color: '#5a6676', textAlign: 'center' },
  reason: { fontSize: 13, color: '#9a5a00', textAlign: 'center' },
  button: { backgroundColor: '#0a5fd6', borderRadius: 14, paddingVertical: 16, alignItems: 'center', margin: 24 },
  buttonText: { color: 'white', fontSize: 17, fontWeight: '600' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  cancel: { fontSize: 17, color: '#0a5fd6' },
  barTitle: { fontSize: 17, fontWeight: '600' },
});
