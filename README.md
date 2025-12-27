Codex task: Implement Pro gating + Paywall + Restore flow (widget stays free, customization + exports are Pro)
Goal

Widget itself remains FREE (users can add/use it).

Customization is PRO: themes, icon picker, widget opacity slider, and export actions (PDF/Text/CSV).

Locked UI should be clickable → opens Paywall.

Paywall must support Buy lifetime + Restore purchases.

Keep existing Developer “Enable Pro (dev)” toggle working for local testing, but ensure it’s not shipped in production builds.

1) Define what is Pro vs Free
FREE

Add/use widget

Tap Pee/Poo cards to add events

View event list + filters in-app

Export screen can be visible, but export actions locked

PRO (locked)

Theme preset picker (all theme presets)

Icon privacy picker (Pee icon, Poo icon)

Widget opacity slider (and any widget customization)

Export buttons: Share PDF, Share Text, Share CSV

(If you want one free theme preset as teaser: keep “Default” free, everything else pro — but you decide. If not specified, lock all customization.)

2) Add a single source of truth: isPro

Create a small Pro state module that can be used everywhere.

Requirements

isPro resolves from:

Real purchase state (store)

OR dev override toggle (dev only)

Persist isPro locally so app doesn’t flicker on launch.

Provide:

usePro() hook returning { isPro, isLoading, purchase(), restore(), error }

requirePro(action) helper that either runs action() or opens paywall

3) Billing implementation (lifetime)
Platform

Android billing via a standard RN billing library already compatible with Expo dev client / prebuild (use whatever is already installed in repo; if none, add one and wire cleanly).

Product

One-time lifetime unlock (non-consumable)

Product ID e.g. pro_lifetime (match Play Console later)

Purchase flow

purchase() triggers purchase

On success:

store entitlement locally (isPro = true)

update UI immediately

On restore:

query purchases / available purchases

if entitlement found → set isPro = true

Important

Do not block app if billing fails.

If billing not available (dev), keep app functional with locked UI.

4) Paywall screen
Entry points

Any locked control or locked export button should open paywall.

Paywall content

Title: “Unlock Pro”

One-liner: “Lifetime unlock. Customize icons, themes, widget opacity, and export.”

Bullet list:

Widget customization (opacity)

Custom icons

Theme presets

Export to PDF/Text/CSV

Buttons:

Buy Lifetime (primary)

Restore Purchases (secondary)

Show price if library supports it; otherwise omit price (don’t hardcode).

Include small “Cancel” / back support.

Navigation behavior

After successful purchase or restore:

Close paywall

Return to the screen the user came from

Previously locked action should work immediately (where reasonable)

5) Gating the Settings screen
Theme preset section

If !isPro:

show the theme options but disabled

tapping anywhere in the section opens paywall

show a small “Pro” badge or lock icon

If isPro:

fully interactive

Icons / Privacy section

Same as above: disabled for free, tap opens paywall.

Widget opacity slider

Keep slider visible

If !isPro:

disable the slider

show current value (default)

tapping slider area opens paywall

6) Gating the Export screen
Buttons

Share PDF (Pro)

Share Text (Pro)

Share CSV (Pro)

If !isPro:

Buttons appear disabled + label includes “(Pro)” (already does)

Tapping a disabled button should STILL open paywall (don’t do nothing).

If isPro:

Buttons run export actions.

7) “Developer: Enable Pro (dev)” toggle
Requirements

Must NOT ship in production.

Hide it behind a dev flag:

__DEV__ only

or build-time env var

In dev:

toggle sets a persisted devProOverride=true/false

isPro = realEntitlement || devProOverride

In production:

dev section not rendered at all

dev override ignored

8) UX polish rules

Locked controls should not feel broken:

They must still respond with paywall open.

Don’t spam paywall:

If paywall already open, ignore repeated taps.

Keep widget free:

No paywall when interacting with widget basics.

9) Testing checklist (Android emulator)

Free user:

App opens normally

Widget works

Settings: theme/icons/opacity show locked → tapping opens paywall

Export: tapping locked buttons opens paywall

Pro (dev toggle or purchase):

All customization works

Opacity changes update widget immediately

Export actions run and share intents appear

App relaunch retains Pro

Restore:

Simulate restore path (library dependent)

Ensure UI updates

10) Deliverable

isPro state implemented + used everywhere

Paywall screen

Purchase + restore wired

Settings + Export gating done

Dev override works only in dev builds