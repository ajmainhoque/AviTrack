import { PageShell } from "@/components/common/page-shell";
import { PrivacyControls } from "@/components/common/privacy-controls";
export const metadata = { title: "Privacy" };
export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="eyebrow">PRIVACY</div>
      <h1>Your browser, your records</h1>
      <p>
        AviTrack does not add advertising trackers or analytics. Anonymous use
        requires no account. This policy describes the application defaults; a
        deployment operator may have its own hosting logs and policies.
      </p>
      <section>
        <h2>Local storage</h2>
        <p>
          Preferences, recent searches and favorites are stored in this browser.
          Selected-aircraft trajectories are stored in IndexedDB, capped at
          3,600 points per track and 50 tracks. Unbookmarked tracks older than
          seven days are removed; the 50-track hard limit also applies to
          bookmarks. Recently opened reference pages may be cached for offline
          access.
        </p>
        <p>
          Live aircraft and weather API responses are not cached by the service
          worker. Public route lookup results are not persisted offline.
        </p>
      </section>
      <section>
        <h2>Requests to providers</h2>
        <p>
          The basemap provider receives normal browser map requests, including
          your IP address and requested tile region. Aviation providers receive
          necessary queries through the application server. Searches are sent
          only to providers needed to fulfil the query; individual lookups are
          cached to reduce requests.
        </p>
        <p>
          Precise geolocation is requested only after you choose the location
          control. It is used to center the map, not stored in an account. Map
          coordinates may appear in the address bar and shared URLs. Shared
          links reveal the map region and selected target.
        </p>
      </section>
      <section>
        <h2>Server data and retention</h2>
        <p>
          The default backend caches bounded aviation requests in process
          memory. It does not globally archive aircraft positions. Optional
          PostgreSQL stores reference data and schedule quota usage. Logging
          omits credentials and upstream URLs containing keys. Hosting platforms
          may separately retain access logs.
        </p>
        <p>
          Background monitoring and account synchronization are not enabled.
          Browser notifications, when supported, require a separate explicit
          permission.
        </p>
      </section>
      <section>
        <h2>Clear this device</h2>
        <PrivacyControls />
      </section>
    </PageShell>
  );
}
