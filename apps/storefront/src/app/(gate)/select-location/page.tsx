import type { Metadata } from 'next';
import { LocationGate } from '@/components/location-gate';

export const metadata: Metadata = {
  title: 'Choose your store',
  description: 'Enter your postcode or pick a Neighbourhood Market branch to start shopping.',
};

export default function SelectLocationPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextPath = searchParams?.next ?? '/';
  return <LocationGate nextPath={nextPath} />;
}
