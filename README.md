

7) Deliverables

New i18n setup integrated into app entry.

Translation files for all 8 languages + English.

Settings screen updated with Language selector.

Short README note: how to add a new language + where strings live.

Note: Store listing translations are handled separately in Play Console later; this task is app UI translations + in-app language switch.

i18n notes:
- UI strings live in `src/i18n/translations/*.json` (use `en.json` as the source of truth).
- Supported language codes live in `src/i18n/languages.ts` and are wired in `src/i18n/index.ts`.
- To add a language: add the code to `SUPPORTED_LANGUAGES`, add a `<code>.json` file matching `en.json` keys, add the language name under `languages` in each translation file, and run `node scripts/check-i18n.js` to verify parity.
