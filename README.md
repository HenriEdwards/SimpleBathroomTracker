Codex Instructions — Fix ReliefLog billing (pro.ts)

Scope / rules

Only edit the ReliefLog project folder.

Only touch pro.ts (and only add small helpers inside it if needed).

Do not refactor unrelated code.

Goal

Remove legacy react-native-iap calls and type-casts.

Use the correct modern API so:

price shows reliably

purchase works reliably

restore works reliably

Product ID must remain: relieflog_pro_lifetime

1) Fix IAP init to be safe across versions

In ensureIapConnection():

Keep IAP.initConnection()

Do not call IAP.flushFailedPurchasesCachedAsPendingAndroid() directly.

Instead, call it only if it exists:

get the function from IAP safely

if it’s a function, call it in try/catch

ignore failures

This removes the “red underline” / compatibility issues.

2) Replace price fetching (remove IAP.getProducts + casts)

ReliefLog currently uses:

(IAP.getProducts as unknown as ...)({ skus })

Delete that whole approach.

Implement price fetch using:

IAP.fetchProducts({ skus: [PRODUCT_ID], type: 'in-app' })

Then:

find the product matching the sku (handle either id or productId)

extract price using this priority:

localizedPrice

oneTimePurchaseOfferDetailsAndroid?.[0]?.formattedPrice

price (string or number)

Add these helpers inside pro.ts:

getProductId(product) → returns product.productId ?? product.id

getProductPrice(product) → returns the best string using the priority above

Set state price to that value (or null).

Optional (recommended): add logs for:

init start/end

product list count + IDs

3) Add purchase listeners (required for reliability)

Add a useEffect that sets up:

A) IAP.purchaseUpdatedListener(async (purchase) => { ... })

ignore if purchase is not for PRODUCT_ID

call IAP.finishTransaction({ purchase, isConsumable: false }) in try/catch

then set entitlement locally: setProPurchased(true)

B) IAP.purchaseErrorListener((err) => { ... })

log error code/message

if code is not E_USER_CANCELLED, set errorKey = 'proErrors.purchaseFailed'

Cleanup:

remove listeners on unmount.

4) Replace purchase() implementation (remove requestPurchase({ sku }) + type hacks)

ReliefLog currently uses:

(IAP.requestPurchase as unknown as ...)({ sku: PRODUCT_ID })

Replace purchase logic with the supported call:

await IAP.requestPurchase({ request: { google: { skus: [PRODUCT_ID] } }, type: 'in-app' })

Then:

normalizePurchase(result) (keep your helper)

finishTransaction({ purchase: purchaseResult, isConsumable: false }) in try/catch

setProPurchased(true)

return true/false properly

set proErrors.billingUnavailable if init fails

set proErrors.purchaseFailed for non-cancel errors

Remove the legacy fallback call:

finishTransaction(purchaseResult as any, false) (delete it)

5) Restore() implementation

Keep restore structure but remove any unnecessary casts.

Use:

const purchases = await IAP.getAvailablePurchases();

check:

purchases.some(p => p.productId === PRODUCT_ID)

if found:

setProPurchased(true)

else:

setErrorKey('proErrors.noPurchasesFound')

Add optional logging:

number of purchases + productIds

6) Acceptance checks
Local build

TypeScript has no red-underlined IAP calls

App runs

Real billing test (must)

Install from Play testing track (not local APK)

Price shows on paywall

Purchase completes → pro unlocks

Restore works after reinstall

Non-negotiables

PRODUCT_ID stays exactly: relieflog_pro_lifetime

Don’t change any storage schema.

Don’t change UI. Only fix the billing logic in pro.ts.