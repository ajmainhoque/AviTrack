import { notFound } from "next/navigation";
import { FlightEntry } from "@/components/flight/flight-entry";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  return {
    title: `${identifier.toUpperCase()} Flight`,
    robots: { index: false, follow: true },
  };
}
export default async function FlightPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  if (!/^[A-Za-z0-9~-]{2,32}$/.test(identifier)) notFound();
  return <FlightEntry identifier={identifier} />;
}
