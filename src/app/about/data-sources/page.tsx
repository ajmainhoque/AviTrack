import { PageShell } from "@/components/common/page-shell";
import { dataSources, termsReviewedAt } from "@/lib/config/sources";
export const metadata = { title: "Data Sources & Limitations" };
export default function SourcesPage() {
  return (
    <PageShell>
      <div className="eyebrow">PROVENANCE & TRANSPARENCY</div>
      <h1>Data sources</h1>
      <p>
        Live ADS-B tracking is not the same thing as airline schedule/status
        data. Receiver observations, reference enrichment, supplier reports and
        local estimates are separate data products.
      </p>
      <p>
        Documentation reviewed {termsReviewedAt}. Availability and terms can
        change. A working API is not a license to redistribute its data.
      </p>
      {dataSources.map((source) => (
        <section key={source.name}>
          <div className="section-heading">
            <h2>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
            </h2>
            <span className="source-badge">{source.status}</span>
          </div>
          <p>{source.supplies}</p>
          <dl className="data-list">
            <div>
              <dt>License / terms</dt>
              <dd>{source.license}</dd>
            </div>
            <div>
              <dt>Refresh behavior</dt>
              <dd>{source.refresh}</dd>
            </div>
          </dl>
          <p>{source.limitations}</p>
        </section>
      ))}
      <section>
        <h2>Unconfigured sources</h2>
        <p>
          No NOTAM, airspace, account synchronization, historical archive
          ingestion, or closed-browser monitoring provider is enabled. The app
          does not scrape consumer trackers, airlines, or NOTAM websites.
        </p>
      </section>
    </PageShell>
  );
}
