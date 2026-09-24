import { notFound } from "next/navigation";
import { PageShell } from "@/components/common/page-shell";
import { AircraftReference } from "@/components/flight/aircraft-reference";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  return { title: `${identifier.toUpperCase()} Aircraft` };
}
export default async function AircraftPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  if (!/^[A-Za-z0-9~-]{2,32}$/.test(identifier)) notFound();
  return (
    <PageShell>
      <AircraftReference identifier={identifier} />
    </PageShell>
  );
}
