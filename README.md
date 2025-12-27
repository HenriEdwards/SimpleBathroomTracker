Batch changes (App + Widget)
A) App: delete an event from the list (with confirm)

Goal: user can undo misclicks.

Add a delete (X) icon per event row in the events list UI (pee + poop lists).

Put it on the far right of the row.

Keep row tap (if any) unchanged; only the X triggers delete.

On press X → show confirm modal

Title: Delete event?

Body should include:

Event type (Pee/Poop)

Event time (formatted same as list)

(Optional) date too if you already show it

Buttons: Cancel (default) and Delete (destructive)

On confirm Delete

Remove from storage/db

Refresh list immediately

Recalculate counts + “last time”

Trigger widget refresh (same mechanism you already use when adding events)

B) App: tighten the two summary columns layout (pee/poop)

Goal: match widget style + cleaner alignment.

In the summary cards/columns (the ones showing icon + “PEE/POOP” + number + last time):

Put number inline next to icon/text (like widget now).

Example row: [icon] PEE 38

Keep last time below, centered.

Center alignment

Center the whole block inside each card/column.

Ensure both columns visually match height/spacing.

C) Widget: change tap behavior (card tap adds; home opens app)

Goal: bigger tap targets, fewer accidental adds while trying to open.

Make each event “card”/panel the tap target

Left card tap → add pee

Right card tap → add poop

Remove click handlers from inner views

Icon/number/+ should be purely visual (no pendingIntent attached)

Only the card container root for each side has the add pendingIntent

Home icon behavior

Home icon tap → open app

Ensure home icon area is clearly separate from cards (so taps don’t trigger add)

Test

Tap on empty space inside the card should add (intended)

Tapping home never increments counts

Tapping near borders doesn’t “leak” to wrong action

D) Settings: replace opacity buttons with a slider + % label (if easy)

Do this if you can do it cleanly without fighting libs.

Goal: user can pick any opacity, show exact %.

Replace the 3 buttons (100/85/70) with a slider control.

Range: 50% → 100% (or 40→100 if you prefer)

Step: 1% or 5% (1% feels nicer)

Show a live label next to it:

Opacity: 73% (updates as user drags)

Persist value

Save selected opacity to the same storage you’re already using for the buttons.

On app launch/settings load, slider reflects saved value.

Apply to widget

When value changes, update widget immediately (same update pathway you already built)

Ensure widget background alpha uses this percentage.

If slider introduces dependency issues (RN slider lib mismatch etc.), revert to buttons and tell me; don’t half-implement.