'use client';

import { use } from 'react';
import { CampaignBuilder } from '@/components/campaign/campaign-builder';

export default function CampaignReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CampaignBuilder opportunityId={id} backHref={`/opportunities/${id}`} />;
}
