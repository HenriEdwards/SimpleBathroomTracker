# Fix: Widget updates counts, but app UI only refreshes after restart

## Problem
- Incrementing pee/poop via the **home-screen widget** updates the widget UI.
- The **React Native app** does NOT reflect the new counts until the app is closed and reopened.
- Incrementing inside the app updates the widget correctly.

## Root cause
The app likely reads counts from shared storage only on initial mount / app launch.
When the widget writes to shared storage, the app doesn’t re-read it.

## Goal
Whenever the app becomes active (foreground), re-load the counts from the same storage the widget uses and update app state.

## Required change (fast win)
### 1) Add "refresh on foreground" in the app
In the screen/component that owns the displayed counts (often Home screen or global store init):

- Listen for app state changes with `AppState`.
- When state changes to `active`, call the existing `loadCounts()` / `getCounts()` function used on startup and update state/store.

Pseudo-logic:
- On mount: loadCounts()
- Subscribe to AppState:
  - if nextState === 'active' => loadCounts()
- Cleanup subscription on unmount.

### 2) Also refresh on navigation focus (if using React Navigation)
If the app uses React Navigation, also refresh when the screen is focused:
- `useFocusEffect` or `navigation.addListener('focus', ...)`
- On focus: loadCounts()

This ensures: user taps widget -> app opens -> counts refresh immediately.

## Notes
- Do NOT rebuild native for this; JS change is enough (unless native module changed).
- Keep it debounced (optional): if multiple AppState events fire, guard with a simple flag/timestamp.

## Optional "best" upgrade (true live update even while app is open)
If we want the app to update instantly while it is already open (no background/foreground), implement a broadcast/event bridge:

- Widget sends a broadcast Intent like: `com.anonymous.BathroomCounter.WIDGET_UPDATED`
- Native receiver forwards to JS (DeviceEventEmitter / expo-modules event)
- App subscribes and triggers loadCounts()

But implement the foreground refresh first (cheap and solves the main pain).

## Acceptance test
1) Open app, leave it running.
2) Go home, tap widget +1 pee.
3) Tap app icon to return.
✅ Count updates immediately without killing the app.
