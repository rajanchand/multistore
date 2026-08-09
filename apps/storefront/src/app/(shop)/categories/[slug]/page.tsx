import ProductsPage from '../../products/page';

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { q?: string };
}) {
  return <ProductsPage searchParams={{ ...searchParams, category: params.slug }} />;
}
