# Contributing

Use Node 22.12+ and npm. Keep changes modular and provenance-first. Do not add sample aircraft to production code, scrape consumer trackers, or assume that a publicly reachable endpoint permits redistribution.

## Development Gates

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright uses deterministic fixtures and port 3100. Live-provider checks are separate, explicit and low-volume. Never make normal CI depend on external aviation availability or secret credentials.

## Adding Providers

1. Review official current documentation and terms first; record URLs, date, limits and uncertainty in `docs/DATA_LICENSES.md`.
2. Implement the appropriate interface under `src/lib/providers`. Add only fixed upstream base URLs, never an arbitrary URL proxy.
3. Validate all external data with Zod. Preserve null/unknown, non-ICAO IDs, `ground` altitude and separate message/position ages.
4. Attach provenance and source timestamps. Do not turn estimates, routes or predictions into observations.
5. Set realistic per-product TTLs, process-wide pacing, authentication isolation and quota controls. Check behavior on 204/404/429/5xx and malformed optional fields.
6. Add representative fixtures under `tests/fixtures`, unit/normalization tests, and a mocked browser case when the user flow changes.

## Normalized Fields

Add fields to the shared model or validated advanced-field registry, not directly to a UI component from provider JSON. Define units, meaning, timestamp assumptions and kind. Never use `any` to bypass an unknown external shape. Keep the raw source value when deriving a correction.

## Airport Reference Updates

Run `npm run data:sync` after applying migrations, or add `--files-only` for database-independent development. Validate all six exports before accepting changes. New CSV columns should be mapped intentionally with fixture coverage; missing required columns must fail the import visibly. Do not commit the generated global reference snapshot. Restart processes after local-file updates.

## Map and History

Use MapLibre layers, not thousands of React markers. Keep animation state outside React. Record only selected-aircraft provider observations; never persist interpolated or projected points. Test the date line, out-of-order updates, impossible jumps, long gaps, midnight and callsign reuse. Keep retention bounded.

## Licensing and Privacy

No keys in browser-prefixed variables, fixtures, logs or commits. Individual metadata caching does not authorize bulk database copying. Do not add photo hotlinks without verified attribution/permission. New analytics, accounts, notifications or background monitoring require explicit privacy and consent design, not a silent addition.
