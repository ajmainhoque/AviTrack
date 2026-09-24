# Data Sources and License Review

Reviewed **2026-09-19** against official documentation where accessible. This is an engineering integration record, not legal advice or a grant of third-party rights. Deployment operators must verify their own intended use, attribution, redistribution and account/tier conditions. APIs and terms can change.

## Default Sources

| Source      | Official references                                                                                                      | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADSB.lol    | https://www.adsb.lol/docs/open-data/api/ ; https://api.adsb.lol ; https://www.adsb.lol/privacy-license/                  | ODbL 1.0. Public regional and direct identity endpoints; no key presently required in docs. Visible attribution retained. Contact the operator before production use as requested by the API page. Respect future key/access changes. Do not assume unlimited request rate; pace requests, cache and honor 429.                                                                                                                                                             |
| OurAirports | https://ourairports.com/data/ ; https://ourairports.com/help/data-dictionary.html                                        | Public Domain, no accuracy guarantee. Explicit six-export import is permitted. Attribution retained voluntarily. Do not mistake community radio/runway reference for operational navigation data.                                                                                                                                                                                                                                                                           |
| NOAA AWC    | https://aviationweather.gov/data/api/ ; https://aviationweather.gov/data/api/#cache ; https://www.weather.gov/disclaimer | US government weather information, subject to NOAA disclaimers. Use backend access and official bulk/cache files for large station layers; bounded per-station queries for METAR/TAF. No browser CORS assumption. 204 is no data.                                                                                                                                                                                                                                           |
| ADSBDB      | https://www.adsbdb.com/ ; https://github.com/mrjackwills/adsbdb                                                          | Public individual lookup API, not blanket permission to mirror constituent databases. Routes credited to David J Taylor and Jim Mason may not be copied, published or incorporated into other databases without permission. This app performs individual transient lookups with short in-memory TTL; no bulk route import, database mirroring or offline route caching. Verify public-display rights for your deployment. Aircraft metadata attribution includes Planebase. |
| OpenFreeMap | https://openfreemap.org/quick_start/ ; https://openfreemap.org/tos/ ; https://openfreemap.org/privacy/                   | Default vector basemap. Terms reviewed include the September 9, 2026 update, integrator age/authority requirements and as-is availability. Keep OpenFreeMap, OpenMapTiles and OpenStreetMap attribution. Do not bulk scrape the hosted service or switch to OSM community standard tiles for production traffic.                                                                                                                                                            |

ODbL may impose attribution, notice and share-alike/access obligations for a publicly used derivative database. Do not relabel combined data as exclusively owned or remove required attribution. Application code and third-party data have separate licenses.

## Optional and Gated

### Airplanes.live

Official guide: https://airplanes.live/api-guide/

The official guide could not be meaningfully extracted in this environment. The adapter follows the documented readsb-compatible regional/direct structure supplied in the project requirements and enforces one request per 1.05 seconds at most. The non-commercial restriction is treated conservatively: both `NON_COMMERCIAL_USE=true` and `AIRPLANES_TERMS_ACCEPTED=true` are required, and the fallback is disabled by default. Current terms, redistribution permission and endpoint behavior must be manually verified before activation. It was not network-tested as an enabled provider.

### ADSBiq

- API docs: https://adsbiq.com/api/docs
- Stream contract: https://adsbiq.com/api/other/websocket
- Terms: https://adsbiq.com/terms

**Conflict found:** API docs describe trial/free/contributor tiers and bearer-key access. Terms last updated March 24, 2026 say non-feeders have no API access, access is non-transferable, and systematic mirroring/republication of the whole aggregated feed is prohibited. Do not treat a technical endpoint or API key as permission for this product's global redistribution.

The adapter remains off by default. `ADSBIQ_ACCESS_CONFIRMED` requires the operator to resolve access rights with ADSBiq. `ADSBIQ_GLOBAL_DISPLAY_AUTHORIZED` separately requires permission for the proposed whole-feed display. `ADSBIQ_TERMS_ACCEPTED` is not a substitute for either. Never set these just to get past a guard.

Documented cadence is free REST once per five minutes, free stream about 150 seconds, contributor/trial REST once per 20 seconds, contributor global stream about 10 seconds, and authorized zone stream as documented for the tier. Credentials are server-only. The code supports full snapshot, sparse delta merge, sequence checking and reconnect. It was fixture-tested, not credential-network-tested.

### OpenSky Network

References: https://openskynetwork.github.io/opensky-api/rest.html ; https://opensky-network.org/about/terms-of-use

Disabled by default. Confirm an operational license/agreement before deployed use. Current authenticated API documentation requires OAuth2 client credentials, not HTTP Basic. Credits depend on bounding-box area and account tier; 429 may include `X-Rate-Limit-Retry-After-Seconds`. The adapter conservatively polls at 60 seconds and does not use previous-day arrival/history endpoints as live schedules. Authenticated access was not network-tested.

### AirLabs

References: https://airlabs.co/docs/schedules ; https://airlabs.co/docs/flight ; https://airlabs.co/terms-of-service

Disabled by default. The public terms do not provide a blanket open-data redistribution grant. Confirm account/plan rights and intended public display before enabling. `SCHEDULE_TERMS_ACCEPTED`, a key, a nonzero budget and PostgreSQL quota storage are required. Board availability is documented as approximately ten hours ahead, not unrestricted future schedules. Records and optional fields vary by plan. Only documented fields are normalized, and actual times are not invented from schedule times. No credentialed request was made during development verification.

## Sources Not Enabled

- NOTAM: no scraping and no assumed complete operational feed. Authorized provider interface and explicit unconfigured airport state exist.
- Airspace: no openAIP or other polygon dataset is shipped without reviewing a specific license and access agreement.
- Historical archives: no per-click bulk archive downloads. Local selected-aircraft history is the only default historical source.
- Photos: no Google Images scraping or unverified hotlinking. The UI uses a silhouette until a separately licensed/attributed photo adapter is supplied.
- Airline websites, FlightRadar24 and FlightAware private/proprietary feeds are not used.

## Software and Derived Data

MapLibre, Turf, Dexie, Drizzle, SunCalc and other packages retain their installed package licenses. Manrope and IBM Plex Mono are self-hosted from their font packages; keep their OFL notices in redistributed package assets. Coordinate-derived timezones use tz-lookup and runtime IANA/Intl timezone rules. PMTiles/Protomaps self-hosting must retain the underlying map-data license and attribution.

## Before Public Deployment

Revisit every enabled source's official terms; resolve ADSBiq conflicts in writing; obtain any OpenSky/schedule/NOTAM/airspace agreements; contact ADSB.lol; verify attribution on all viewport sizes; and configure one shared rate budget for every process using the same provider identity. Stop using a source if its permissions or technical conditions no longer fit the deployment.
