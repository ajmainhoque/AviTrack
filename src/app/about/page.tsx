import Link from "next/link";
import { PageShell } from "@/components/common/page-shell";
export const metadata = { title: "About AviTrack" };
export default function AboutPage() {
  return (
    <PageShell>
      <div className="eyebrow">INDEPENDENT AVIATION OBSERVATIONS</div>
      <h1>AviTrack</h1>
      <p>
        A map-first flight tracker built around real receiver observations and
        open airport reference data. No accounts, advertising analytics, or
        invented live aircraft.
      </p>
      <section>
        <h2>What an observation can tell you</h2>
        <p>
          ADS-B can supply position, altitude, groundspeed, ground track and
          avionics fields. Some positions are multilaterated or relayed through
          TIS-B. Broadcast values can be incomplete, delayed or wrong.
        </p>
        <p>
          Airline schedules, gates, cancellations and arrival estimates are
          separate supplier data. A disappearing aircraft is not proof that it
          landed. A reused callsign is not a unique flight identifier.
        </p>
      </section>
      <section>
        <h2>Reading the map</h2>
        <p>
          Solid trails join actual observations captured while an aircraft is
          selected. Dashed geodesics are direct route references, not flight
          plans. Dotted lines are optional estimated projected tracks, not
          observations. Aircraft icons point along ground track, not necessarily
          nose heading.
        </p>
        <p>
          Barometric altitude references pressure. Geometric altitude references
          an ellipsoid. Neither is automatically height above terrain.
        </p>
      </section>
      <section>
        <h2>Coverage and safety</h2>
        <p>
          The free default queries one region of up to 250 nautical miles. World
          zoom does not imply global live coverage. Local history is not a
          complete flight record.
        </p>
        <p>
          This application is informational and is not an approved source for
          flight planning, navigation, air traffic control or safety-of-flight
          decisions.
        </p>
        <Link className="button" href="/about/data-sources">
          Sources, licenses & limitations
        </Link>
      </section>
    </PageShell>
  );
}
