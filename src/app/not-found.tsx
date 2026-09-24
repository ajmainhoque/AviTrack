import Link from "next/link";
import { PageShell } from "@/components/common/page-shell";
export default function NotFound() {
  return (
    <PageShell>
      <div className="eyebrow">404</div>
      <h1>Record not found</h1>
      <p>This page or aviation identifier could not be found.</p>
      <Link className="button primary" href="/map">
        Return to live airspace
      </Link>
    </PageShell>
  );
}
