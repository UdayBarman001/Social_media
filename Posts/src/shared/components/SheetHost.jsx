import { useSyncExternalStore, useLayoutEffect } from "react";
import { View, StyleSheet } from "react-native";

// ─────────────────────────────────────────────────────────────────────────
// Why this exists
// ─────────────────────────────────────────────────────────────────────────
// React Native's <Modal> renders through a native Android Dialog window
// that is completely separate from the Activity's own window. That Dialog
// has its own android:windowSoftInputMode, and it CANNOT be set from JS —
// not via AndroidManifest / app.json (which only configures the Activity),
// and not via react-native-keyboard-controller's KeyboardController
// .setInputMode() at runtime (same limitation — Activity window only).
// That mismatch is the actual root cause behind CommentSheet's Android
// double-tap-to-send bug: whatever soft-input mode the Dialog silently
// defaults to fights with KeyboardStickyView's own keyboard-frame tracking,
// so the composer/send button's real position drifts from where it's
// drawn, and the first tap lands on nothing.
//
// The fix isn't a better runtime toggle — there isn't one reachable from
// JS. It's to not open a second window at all. Anything pushed through
// this host renders as an ordinary sibling inside the SAME window as the
// rest of the app (mounted once, here, at the true root — see
// app/_layout.jsx), so app.json's softwareKeyboardLayoutMode and
// KeyboardStickyView both apply to it exactly the way they apply to every
// other screen. No separate Dialog, no separate soft-input mode, no drift.
//
// This also incidentally fixes something Modal was papering over: content
// that needs to render "on top of everything" but originates deep inside a
// FlatList row (like CommentSheet does, from PostCard) can't safely do that
// with a plain `position: absolute` View — FlatList/ScrollView clip their
// content natively, so it would be cut off at the row's own bounds instead
// of covering the screen. Portaling to the root sidesteps that too.
// ─────────────────────────────────────────────────────────────────────────

const sheets = new Map(); // id -> ReactNode (source of truth, mutated freely)
const listeners = new Set();

// useSyncExternalStore decides whether to re-render by comparing what
// getSnapshot() returns across calls (via Object.is). Returning `sheets`
// itself here would return the SAME Map reference every time — mutating a
// Map in place doesn't change its identity — so React can (and does)
// conclude "nothing changed" and skip re-rendering SheetHost even after a
// real push/pop and an emit(). That was a real bug here, not a theoretical
// one: it silently ate every portal update, so a sheet's own open/close
// state could flip correctly while the thing meant to display it never
// re-rendered. Keeping a separate, freshly-created array as the published
// snapshot — replaced (not mutated) on every change — gives
// useSyncExternalStore a new reference exactly when, and only when, the
// content actually changed.
let snapshot = [];

function publish() {
  snapshot = Array.from(sheets.entries());
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

/** Mount once, at the app root — inside GestureHandlerRootView and
 *  KeyboardProvider, so anything portaled here still gets gesture
 *  handling and keyboard-frame tracking. Renders after (i.e. visually on
 *  top of) whatever else is in the root tree, since later siblings paint
 *  over earlier ones in React Native. */
export function SheetHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (current.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}>
      {current.map(([id, node]) => (
        <View key={id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {node}
        </View>
      ))}
    </View>
  );
}

/** Registers `node` under `id` while `active` is true; unregisters on
 *  `active` going false or on unmount. Re-registers on every render so a
 *  parent's state changes (typing, new comments, etc.) are reflected in
 *  the portaled content — content ownership stays with the caller
 *  (CommentSheet), this just relays it to the root. useLayoutEffect (not
 *  useEffect) so the portal updates before the browser/native paint,
 *  avoiding a one-frame flash of stale content on rapid updates. */
export function useSheetPortal(id, active, node) {
  useLayoutEffect(() => {
    if (!active) return;
    sheets.set(id, node);
    publish();
    return () => {
      sheets.delete(id);
      publish();
    };
  });
}