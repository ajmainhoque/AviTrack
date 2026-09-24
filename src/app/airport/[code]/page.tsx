import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAirportDetail } from "@/lib/server/airports";
import { PageShell } from "@/components/common/page-shell";
import { AirportDetailView } from "@/components/airport/airport-detail";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} Airport`,
    alternates: { canonical: `/airport/${code.toUpperCase()}` },
  };
}
export default async function AirportPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^[A-Za-z0-9-]{2,16}$/.test(code)) notFound();
  const detail = await getAirportDetail(code).catch(() => undefined);
  if (detail === null) notFound();
  if (detail === undefined) {
    return (
      <PageShell>
        <h1>Airport reference unavailable</h1>
        <p>
          The airport database has not been imported or is temporarily
          unavailable. Live tracking remains available.
        </p>
      </PageShell>
    );
  }
  return <PageShell><AirportDetailView detail={detail} /></PageShell>;
}
