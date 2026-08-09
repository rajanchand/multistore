import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">Customer records are permission-scoped by business need</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Customer search and detail views are available via the API (`customer.read`). Seed customers use
          `@example.dev` addresses for development only.
        </CardContent>
      </Card>
    </div>
  );
}
