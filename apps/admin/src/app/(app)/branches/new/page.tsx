import { BranchForm } from '@/components/branch-form';

export default function NewBranchPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create branch</h1>
        <p className="text-sm text-muted-foreground">
          Add a retail location. Codes and slugs must be unique.
        </p>
      </div>
      <BranchForm mode="create" />
    </div>
  );
}
