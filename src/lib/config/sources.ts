export const termsReviewedAt = "2026-09-19";
export const dataSources = [
  {
    name: "ADSB.lol",
    supplies: "Regional live aircraft and individual identity queries",
    license: "ODbL 1.0",
    refresh:
      "5s regional / 2.5s selected by default; server pacing and 429 cooldown",
    limitations:
      "Volunteer receiver coverage; not airline schedules. Contact ADSB.lol before production use as requested by its API documentation. ODbL attribution and applicable share-alike obligations remain with operators.",
    url: "https://api.adsb.lol",
    status: "Default",
  },
  {
    name: "OurAirports",
    supplies:
      "Airports, runways, radio frequencies, navaids, countries and regions",
    license: "Public Domain",
    refresh: "Official exports update nightly; explicit local synchronization",
    limitations:
      "Community reference data, not an authoritative navigation database. Per-record observation dates are not supplied. Full validated fields retained.",
    url: "https://ourairports.com/data/",
    status: "Default after import",
  },
  {
    name: "NOAA Aviation Weather Center",
    supplies: "METAR, TAF, SIGMET, international SIGMET, G-AIRMET, PIREP/AIREP",
    license: "US government data; NOAA disclaimer applies",
    refresh:
      "METAR/advisories cached 2 min; TAF/G-AIRMET 10 min; bulk METAR cache preferred",
    limitations:
      "Coverage differs by product. Flight categories follow US ceiling/visibility conventions. Not approved for operational flight planning. All calls go through the backend.",
    url: "https://aviationweather.gov/data/api/",
    status: "Default",
  },
  {
    name: "ADSBDB",
    supplies: "Individual aircraft, airline and callsign-route enrichment",
    license:
      "Source-specific restrictions; not a freely redistributable route database",
    refresh: "Aircraft 3 days; routes 15 min; airline code lookups 1 day",
    limitations:
      "Routes credited to David J Taylor and Jim Mason may not be copied, published or incorporated into other databases without permission. Individual transient lookups only; no bulk import, route persistence, or offline route caching. Aircraft database: Planebase. No photo hotlinking without separately verified permission.",
    url: "https://www.adsbdb.com/",
    status: "Default individual lookups",
  },
  {
    name: "OpenFreeMap",
    supplies: "Hosted vector basemap",
    license: "Hosted service terms; OSM data ODbL, OpenMapTiles attribution",
    refresh: "Provider-managed tile caching",
    limitations:
      "No guaranteed availability. Integrators must satisfy the current terms, including age/authority requirements. MapLibre attribution is retained. Configurable style and PMTiles protocol support for self-hosting.",
    url: "https://openfreemap.org/tos/",
    status: "Default",
  },
  {
    name: "Airplanes.live",
    supplies: "Optional regional and selected-aircraft fallback",
    license: "Non-commercial public API; operator must confirm current terms",
    refresh: "At most one outbound request per 1.05 seconds per process",
    limitations:
      "Official guide could not be extracted during review. Disabled unless both NON_COMMERCIAL_USE and AIRPLANES_TERMS_ACCEPTED are explicitly set. Recheck official terms before enabling; do not enable for commercial deployment.",
    url: "https://airplanes.live/api-guide/",
    status: "Disabled",
  },
  {
    name: "ADSBiq",
    supplies:
      "Optional authenticated REST snapshots and sequence-checked WebSocket streams",
    license:
      "Contractual terms; explicit access and global-display authorization required",
    refresh:
      "Docs: free REST 5 min / stream 150s; contributor REST 20s / global stream 10s; authorized zone cadence source-dependent",
    limitations:
      "Documentation and terms conflict: docs describe free/trial access while terms say active feeders only and forbid republishing the entire aggregate feed. Do not infer permission from a working endpoint. Obtain written clarification before activation. No credentials sent to the browser.",
    url: "https://adsbiq.com/terms",
    status: "Disabled",
  },
  {
    name: "OpenSky Network",
    supplies: "Optional geographic state vectors and ICAO lookup",
    license: "Operational use subject to OpenSky agreement/licensing",
    refresh: "60s default; credit and 429 limits respected",
    limitations:
      "Disabled by default; explicit license confirmation required. OAuth2 client credentials only when authenticated. Flight history endpoints are not used as live schedules. Callsign/registration lookup unsupported by this adapter.",
    url: "https://openskynetwork.github.io/opensky-api/rest.html",
    status: "Disabled",
  },
  {
    name: "AirLabs",
    supplies: "Optional supplier flight records and airport boards",
    license: "Account/plan-specific API terms; no blanket redistribution grant",
    refresh: "Flight lookups 60s; boards 3 min; PostgreSQL monthly quota guard",
    limitations:
      "Disabled without access confirmation, key, budget and database. Documented boards extend only up to about 10 hours, not arbitrary future dates. Schedule results are displayed separately when identity cannot be confidently matched. Not used for map positions.",
    url: "https://airlabs.co/terms-of-service",
    status: "Disabled",
  },
  {
    name: "Local calculations & history",
    supplies:
      "Captured observations, distance, bearing, phase, progress, projected track, solar geometry and coordinate-derived time zones",
    license:
      "Local calculations using Turf, SunCalc, tz-lookup and IANA/Intl time zones",
    refresh: "Derived from original observation timestamps",
    limitations:
      "Not measured or authoritative. Trails are selected-aircraft observations from this browser only. Predictions are optional, short-term and disabled for stale or turning targets. Phase labels are deliberately conservative.",
    url: "https://turfjs.org/",
    status: "Enabled",
  },
] as const;
