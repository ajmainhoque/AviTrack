import { notFound } from "next/navigation";
import { AirlineReference } from "@/components/flight/airline-reference";
import { PageShell } from "@/components/common/page-shell";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return { title: `${code.toUpperCase()} Airline` };
}
export default async function AirlinePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{2,3}$/.test(code)) notFound();
  return (
    <PageShell>
      <AirlineReference code={code.toUpperCase()} />
    </PageShell>
  );
}
