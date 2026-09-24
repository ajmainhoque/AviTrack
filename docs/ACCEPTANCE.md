# Verification and Acceptance

Verification date: **2026-09-19**. This is a working free-first regional tracker, not a claim that every optional capability in the master specification is complete or licensed for public deployment.

## Executed Gates

- Strict TypeScript: passed.
- ESLint: passed without warnings.
- Vitest: 32 tests across 11 files passed.
- Next.js standalone production build: passed, all intended routes generated, no build warnings.
- Playwright: 14 desktop/mobile cases passed against the standalone production server with mocked upstreams. Includes nonblank canvas pixels, panel-aware followed-aircraft visibility, source details, keyboard search, local favorites, unit persistence, captured-history playback, airports/weather, filters, 429 handling, unknown routes, stale positions, hidden-tab suppression/resume and zero serious/critical axe violations on the initial interface.
- PWA production smoke check: registered/controlling service worker, PNG icons at 192/512, offline navigation fallback, no live/weather/schedule/search/route responses in offline caches.
- npm audit: zero vulnerabilities after a narrow development esbuild override. Drizzle migration generation rechecked successfully with no schema changes.

Browser screenshots and traces are generated under ignored `test-results/` and `playwright-report/`. PWA verification screenshot is under `artifacts/`. CI fixtures are confined to `tests/`, with an explicitly selected temporary reference file used by the test server only.

## Real Network Checks

- ADSB.lol adapter returned 206 aircraft with zero rejected essential records during an initial regional check. Later browser sessions rendered hundreds of actual observations on a real OpenFreeMap basemap.
- Real aircraft selection and follow were exercised; observed altitude/speed changed and a selected track accumulated actual points. No fixture data was inserted into the production application.
- The six official OurAirports exports imported 86,095 airports, 48,248 runways, 30,346 frequencies, 11,008 navaids, 249 countries and 3,987 regions. Counts are a dated observation, not fixed application assumptions.
- Heathrow reference lookup returned its real name, two runways and 15 radio frequencies. Airport text search resolved Heathrow.
- Server weather checks returned METAR and TAF successfully, 5,055 bulk METAR stations, 12 SIGMET features, 143 international SIGMET features, 27 G-AIRMET features and 3 PIREPs in a bounded test region. These counts vary with issue time and coverage.
- Disabled ADSBiq stream access returned HTTP 403, not an unauthenticated external stream.
- Real provider 429 responses were encountered. The app retained prior observations, marked interruption and honored cooldown instead of presenting sample aircraft. Shared server pacing was tightened to avoid duplicate route-handler/hot-reload budgets.
- A short browser animation-frame sample with 262 rendered targets measured about 6.2 ms p95 in this environment. This is a local sample, not a guaranteed performance result on all hardware, nor a Lighthouse score.

ADSBDB was checked against official schemas and exercised through the application, but selected live aircraft sometimes had no metadata/route or the service was unavailable. Deterministic route/metadata behavior is covered by fixtures. Do not interpret a successful fixture as proof that every public callsign resolves live.

## Final 40-Item Checklist

| Requested acceptance | Evidence / state |
| --- | --- |
| 1. Open site | Development and standalone production servers exercised |
| 2. Real map | OpenFreeMap vector assets verified; MapLibre 6 worker integration fixed and tested |
| 3. Real aircraft | ADSB.lol network and browser verified |
| 4. Icon rotation | Ground-track-driven symbol rotation implemented and visually checked |
| 5. Click aircraft | Canvas selection tested on desktop/mobile |
| 6. Immediate panel | Uses existing normalized map state; tested |
| 7. Smooth movement | Great-circle interpolation, bounded animation; real follow exercised |
| 8. Actual trail grows | Real selected observations accumulated; local session/midnight tests |
| 9. Telemetry updates | Real and fixture updates exercised |
| 10. ADS-B details | Advanced field/source view tested |
| 11. Nonblocking metadata | Separate query/error boundary from live tracking |
| 12. Known route | Fixture route lookup and mapping tested; live availability source-dependent |
| 13. Unknown route | Explicit unavailable state tested |
| 14. Origin/destination | Route markers and labels implemented; fixture route rendered |
| 15. Dashed reference | Dedicated dashed geodesic layer rendered |
| 16. Honest route label | Direct reference, observed trail and estimate labels are separate |
| 17. Charts | Altitude, groundspeed, vertical rate and replay tested |
| 18. Chart/map cursor | Shared timestamp state implemented; no dedicated bidirectional hover assertion yet |
| 19. Airport search | Real and mocked Heathrow checks passed |
| 20. Airport detail | Server-rendered reference page and mobile browser test passed |
| 21. Runways | Real import, geometry and detail fields verified |
| 22. Frequencies | Real import and browser rendering verified |
| 23. METAR backend | Real server call passed |
| 24. TAF | Real server call passed after an earlier transient timeout |
| 25. Weather source/time | Preserved observation/issue time and source shown |
| 26. Filters | Client-side filtering tested |
| 27. Units | Central conversion tests and browser persistence passed |
| 28. UTC/local | Intl/IANA conversion and DST regression passed |
| 29. Mobile | Bottom sheet/screenshots/overflow/follow visibility tested |
| 30. Favorites | Persist/reload test passed |
| 31. Hidden tabs | Request suppression and visibility resume tests passed |
| 32. 429 | Real cooldown observed and mocked resilience/browser tests passed |
| 33. Provider downtime | Cached/error states and circuit-breaker path implemented; mocked interruption tested |
| 34. Stale aircraft | Position-age-based fading/labels tested |
| 35. Anti-meridian | Both directions and interpolation unit tests passed |
| 36. Tests | 32 unit/integration plus 14 browser cases passed |
| 37. Production build | Passed |
| 38. Secret isolation | Only explicit safe config fields returned; credentials remain in server adapters |
| 39. Attribution | OpenFreeMap/OSM/OpenMapTiles and ADSB.lol visible; data-source page included |
| 40. Setup documentation | README, environment example, migration/import steps, Docker and CI included |

## Not Verified Here

No PostgreSQL or Docker executable was available, and no optional provider credentials or agreements were supplied. Therefore PostgreSQL migration execution/upsert transactions, Docker image runtime, authenticated OpenSky, permitted Airplanes.live, ADSBiq live streams and AirLabs billed endpoints were **not** network/runtime-verified. Their schemas, contracts, normalization and relevant fixtures are implemented; that is not the same as testing an authorized deployment.

No Lighthouse audit was executed. Initial-interface axe and local frame sampling are narrower checks, not a complete accessibility/performance certification.

## Remaining Product Scope

- Complete airline-name search needs a licensed/open airline directory; current remote airline lookup uses IATA/ICAO codes.
- Conservative phase labels currently stop at parked/taxi/climb/cruise/descent/unknown. Dedicated takeoff/landing/approach phase hysteresis and richer airport arrival/departure inference are not complete.
- Optional supplier records and boards are separate from observed traffic. Strong automatic schedule-to-aircraft matching, authoritative diversion presentation, arbitrary-date future schedules and preferred reported ETA integration are not complete.
- Compare mode provides telemetry/separation for up to three currently observed aircraft; simultaneous persistent trails for all three are not implemented.
- Terrain DEM, dedicated 3D buildings, globe switching, configured filed flight plans, licensed photos, authorized NOTAM/airspace adapters, historical archive ingestion and account synchronization are not shipped. Pitch, PMTiles protocol and modular interfaces exist.
- Foreground alerts are opt-in and limited to current coverage while visible. No closed-browser/server background monitoring is implemented.
- Airspace/NOTAM/schedule provider absence is explicit. ADSBiq access/global redistribution needs written clarification because its public docs and terms conflict.
- In-process cache/rate limits require one BFF replica or a shared distributed limiter before horizontal scaling. The quota table alone does not solve general multi-instance provider pacing.

## Manual Deployment Verification

1. Obtain appropriate provider permissions, contact ADSB.lol for production use, and review `DATA_LICENSES.md` again.
2. Set a TLS PostgreSQL `DATABASE_URL`; run `npm run db:migrate` then `npm run data:sync`. Check imported counts and Heathrow runway/frequency queries against the local-file path.
3. Run `npm run build`, `npm start`; open the map and select an aircraft. Verify original source times, trajectory growth, unavailable-route honesty, and request cadence under network throttling.
4. Open `/airport/EGLL` and another airport without IATA. Verify raw METAR/TAF, issue age, runway threshold fields and unavailable weather behavior.
5. Test a shared link, mobile follow, UTC/local display, saved favorites and local replay after reload.
6. Run `APP_URL`-configured `npx tsx scripts/verify-pwa.ts` against an isolated local production server. It uses an isolated browser profile, not the user's active browser.
7. For optional adapters, start with minimal authorized queries, validate reported tier cadence and remaining budget, then test 429/credentials-expired behavior. Never bypass a gate merely to make an endpoint return data.