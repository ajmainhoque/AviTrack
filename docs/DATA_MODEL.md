# Data Model

## Provenance

`DataValue<T>` carries `value`, `source`, `observedAt`, `receivedAt`, `ageSeconds`, `kind`, `confidence` and `isStale`.

- `observed`: receiver positions and broadcast values, or weather observations.
- `reported`: supplier schedule fields, TAF/advisories.
- `enriched`: aircraft database identity, airport reference, public callsign route.
- `inferred`: phase, possible runway alignment, coordinate-derived timezone.
- `estimated`: speed-based remaining time, projected track and solar overlay.

Unknown observation timestamps remain null, never the current time. Confidence is `unknown` when not independently established. `ageSeconds`/`isStale` describe normalization-time freshness; the UI recomputes position/message age from absolute timestamps. Source badges/tooltips and the ADS-B data view expose provenance. Raw broadcast values are not guarantees of accuracy.

Most readsb fields do not include their own observation timestamp. The newest message timestamp is used as an upper bound for those fields, not a claim that every field was refreshed then. Position uses `seen_pos` separately. Enrichment/reference records keep null observation time and explicit retrieval/sync time.

## Aircraft Identity

`AircraftState.id` preserves the complete provider target identifier, including non-ICAO prefixes such as `~`. It is not always a valid six-digit ICAO24. Registration and callsign are nullable. A blank callsign does not hide a target. Live registration/type take display precedence over metadata values, with each field's source retained.

`altBaro` is `number | "ground"`. Ground is never silently converted to zero altitude. Barometric and geometric altitude remain distinct. Raw units are feet, knots, ft/min, hPa and Celsius; conversion is centralized at display time. Track is direction across ground, not nose heading.

The advanced `fields` dictionary validates known scalar/array readsb values for airspeed, Mach, headings, autopilot selections/modes, transponder state, quality indicators and aircraft-observed atmosphere. Missing values are omitted or displayed as unavailable, never fabricated.

## Flights and Callsign Ambiguity

A callsign is not a permanent flight ID. Local session identity combines target ID, current callsign and the first observed session timestamp. A callsign change or gap exceeding 30 minutes starts a new local session. A continuous flight crossing UTC midnight stays in the same session. This is a local observation identity, not an authoritative airline flight instance.

IATA-format flight search first attempts a public route mapping, then a unique airline-prefix mapping where available. Such mapping is not guaranteed: operating callsigns, codeshares and reused flight numbers can differ. Duplicate live/supplier records remain separate choices.

## Route and Schedule

`Route` contains known origin/destination, optional midpoint, airline and callsign aliases. ADSBDB routes are labeled public enrichment and may be stale or reused. They are not confirmed filed flight plans. The map renders only a dashed direct geodesic reference from this data.

`ScheduleRecord` contains nullable supplier dates, scheduled/estimated/actual UTC times, gates, terminals, baggage, delays, status and code-share references. Missing supplier fields are not displayed. Unknown date/registration prevents confident automatic matching. Supplier records are currently displayed separately; no weak record silently overrides live identity or public route.

Desired precedence for a future strongly matched integration is: matching reported route/ETA, then public enrichment/local estimate, then unavailable. Do not implement precedence by combining unrelated flight records merely because their callsigns match.

## Observations and Trajectories

`TrackPoint` records provider-observed time, coordinate, barometric/geometric altitude, speed, vertical rate, track, source and all available advanced fields. Only real observations are persisted; interpolated icon positions and projected points never enter actual history.

Duplicate/out-of-order points and implausible motion are rejected. The jump threshold is deliberately permissive: 2,500 kt plus 0.15 NM tolerance. Lines are split at the anti-meridian and gaps over 30 seconds are not connected. Compression preserves heading, altitude and significant speed changes, with an explicit hard retention bound.

Progress and remaining distance use Turf great-circle calculations. ETA is suppressed for ground, slow, stale, unknown-position or wrong-direction cases. Phase inference requires a stable recent time window and currently uses only conservative labels; no takeoff/landing certainty is invented without sufficient context.

## Airport and Weather Records

OurAirports `ident` is the external stable key; its numeric `id` is also retained. IATA is optional. Codes, names, city/country and keywords support reference search. Every useful runway endpoint, heading, lighting and displaced-threshold field is retained; so are frequency and navaid details. The sync timestamp is not a claimed real-world inspection date.

Weather observations retain raw and decoded reports and original observation/issue times. TAF periods are reported forecasts, not observations. Flight categories are the provider's US-style ceiling/visibility classification or explicitly derived using those rules, not universal aviation law. AWC JSON visibility is labeled in statute miles to avoid treating it as nautical miles.

## Time, Storage and Privacy

Internal timestamps are UTC epoch milliseconds; provider seconds/milliseconds are normalized explicitly. Supplier `_utc` strings are parsed as UTC. IANA timezone display uses `Intl`; no fixed DST offsets are stored. Coordinate-inferred airport zones are labeled inferred.

PostgreSQL stores reference data, source synchronization and optional quota/account-ready tables. No global position table is populated. Local history and settings remain in the browser. The privacy page provides a local-data clearing control.
