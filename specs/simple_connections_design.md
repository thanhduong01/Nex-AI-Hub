# Simplified AI connection setup

User chose centralized API chat in Hub: Owner configures once, employees only log in to Hub. Keep seven-day Supabase authentication and existing access/budget controls.

## UI and behavior

- Provider cards expose one Connect action per provider. New connection dialog requires only an API key, with a preset text model and prices; provider is selected by the card.
- Preserve the option to add more connections and all existing model/price/grant values when editing.
- Native details discloses connection name, custom model and prices, output limit, enabled state and employee access. Grant all currently active employees on new connections only, with a clear summary; do not auto-grant future users.
- Hide subscription bookkeeping under a separate disclosure. Meta remains import-only; no simulated login or connection state.
- Show a direct budget setup link when workspace budget is zero; do not raise budgets automatically.
- After successful save, clear the typed key and disable duplicate submission until inputs change.

## Backend and security checkpoint

- Validate input on client/server. Owner and workspace checks precede key decryption or provider requests. Preserve authenticated SQL RPC recheck on write.
- New keys or changed/enabled models must pass a read-only model metadata request before storing. Provider origins are hardcoded, model path encoded, no redirects, no paid generation, no retries. Errors never include keys/provider response bodies.
- Existing disabled connections can be disabled/edited without requiring an available provider. Changing a key still verifies the new credentials.
- Keep encryption, per-user grants, RLS and budget reservation unchanged. No migration or provider website-password storage.
- Verify failure-before-write, edit permissions, stale keys and provider error handling with focused tests; run existing checks and production build before push.

## Preset maintenance

Presets are explicit owner-reviewable defaults, checked against official model/pricing documentation on 2026-11-03; they are not a live price feed or a promise of account quota. Keep pricing links with the catalog. Custom model IDs require explicitly entering their prices rather than silently inheriting preset rates. Existing connections never change on a catalog update.

Initial text presets: GPT-4.1 mini ($0.40/$1.60), Claude Haiku 4.5 snapshot 20251001 ($1/$5), Gemini 2.5 Flash-Lite ($0.10/$0.40), input/output USD per million tokens. These use the existing text-only streaming flow without enabling reasoning. Sources: [OpenAI](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [Anthropic](https://platform.claude.com/docs/en/models/haiku-4-5/overview), [Google](https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-lite). They are initial defaults, not a claim to be the latest models.
