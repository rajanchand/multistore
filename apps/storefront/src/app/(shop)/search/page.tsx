import ProductsPage from '../products/page';

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  return <ProductsPage searchParams={searchParams} />;
}
