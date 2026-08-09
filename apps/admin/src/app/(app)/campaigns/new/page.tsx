import { CampaignForm } from '@/components/campaign-form';

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create campaign</h1>
        <p className="text-sm text-muted-foreground">
          Draft a marketing campaign. Link SMS sends from the SMS page using the campaign id.
        </p>
      </div>
      <CampaignForm />
    </div>
  );
}
