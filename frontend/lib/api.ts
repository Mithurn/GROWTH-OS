const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://xeno-crm-backend-n6d8.onrender.com/api';

export async function saveBusinessInfo(companyName: string, industry: string) {
  const response = await fetch(`${API_BASE_URL}/onboarding/business`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyName, industry }),
  });

  if (!response.ok) {
    throw new Error('Failed to save business info');
  }

  return response.json();
}

export async function saveOnboardingProfile(
  companyId: string,
  profile: Record<string, unknown>,
) {
  const response = await fetch(`${API_BASE_URL}/onboarding/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, profile }),
  });

  if (!response.ok) {
    throw new Error('Failed to save onboarding profile');
  }

  return response.json();
}

export async function startOnboardingConversation(companyId: string) {
  const response = await fetch(`${API_BASE_URL}/onboarding/conversation/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId }),
  });

  if (!response.ok) {
    throw new Error('Failed to start conversation');
  }

  return response.json();
}

export async function sendConversationMessage(conversationId: string, message: string) {
  const response = await fetch(`${API_BASE_URL}/onboarding/conversation/${conversationId}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

export async function uploadCustomerCSV(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload/customers`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload customer CSV');
  }

  return response.json();
}

export async function uploadOrderCSV(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload/orders`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload order CSV');
  }

  return response.json();
}

export async function startIngestion(customerFile: File, orderFile: File) {
  const formData = new FormData();
  formData.append('customers', customerFile);
  formData.append('orders', orderFile);

  const response = await fetch(`${API_BASE_URL}/process-ingestion`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to start ingestion');
  }

  return response.json();
}

export async function getIngestionStatus(sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/ingestion-status/${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to get ingestion status');
  }

  return response.json();
}

export async function getIntelligencePreview() {
  const response = await fetch(`${API_BASE_URL}/intelligence-preview`);

  if (!response.ok) {
    throw new Error('Failed to get intelligence preview');
  }

  return response.json();
}

export async function getIntelligenceBrief(companyId?: string) {
  const url = new URL(`${API_BASE_URL}/analytics/intelligence-brief`);
  if (companyId) {
    url.searchParams.set('companyId', companyId);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function generatePersonas(companyId?: string, model?: string) {
  const response = await fetch(`${API_BASE_URL}/personas/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, model }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate personas');
  }

  return response.json();
}

export async function generateOpportunities(companyId?: string, model?: string) {
  const response = await fetch(`${API_BASE_URL}/opportunities/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, model }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate opportunities');
  }

  return response.json();
}

export async function getOpportunityDashboard(companyId?: string) {
  const url = new URL(`${API_BASE_URL}/opportunities`);
  if (companyId) {
    url.searchParams.set('companyId', companyId);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch opportunities');
  }

  return response.json();
}

export async function getOpportunityCustomers(opportunityId: string) {
  const response = await fetch(`${API_BASE_URL}/opportunities/${encodeURIComponent(opportunityId)}`);

  if (!response.ok) {
    throw new Error('Failed to fetch opportunity details');
  }

  return response.json();
}

export async function createOpportunityFromGoal(goal: string, companyId?: string, model?: string) {
  const response = await fetch(`${API_BASE_URL}/opportunities/create-from-goal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ goal, companyId, model }),
  });

  if (!response.ok) {
    throw new Error('Failed to create opportunity from goal');
  }

  return response.json();
}

export async function getPersonaDistribution(companyId?: string) {
  const url = new URL(`${API_BASE_URL}/personas`);
  if (companyId) {
    url.searchParams.set('companyId', companyId);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch personas');
  }

  return response.json();
}

export async function getPersonaCustomers(personaName: string, companyId?: string) {
  const url = new URL(`${API_BASE_URL}/personas/${encodeURIComponent(personaName)}`);
  if (companyId) {
    url.searchParams.set('companyId', companyId);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch persona customers');
  }

  return response.json();
}

// ============================================
// CAMPAIGNS
// ============================================

export async function generateCampaign(opportunityId: string, companyId?: string, model?: string) {
  const response = await fetch(`${API_BASE_URL}/campaigns/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ opportunityId, companyId, model }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate campaign');
  }

  return response.json();
}

export async function saveCampaign(opportunityId: string, campaign: any, companyId?: string) {
  const response = await fetch(`${API_BASE_URL}/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ opportunityId, campaign, companyId }),
  });

  if (!response.ok) {
    throw new Error('Failed to save campaign');
  }

  return response.json();
}

export async function getCampaigns(companyId?: string) {
  const url = new URL(`${API_BASE_URL}/campaigns`);
  if (companyId) {
    url.searchParams.set('companyId', companyId);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch campaigns');
  }

  return response.json();
}

export async function getCampaignById(campaignId: string) {
  const response = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}`);

  if (!response.ok) {
    throw new Error('Failed to fetch campaign');
  }

  return response.json();
}

export async function approveCampaign(campaignId: string) {
  const response = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to approve campaign');
  }

  return response.json();
}

export async function launchCampaign(campaignId: string) {
  const response = await fetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/launch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to launch campaign');
  }

  return response.json();
}

// ============================================
// AI AGENTS
// ============================================

export async function createAgent(companyId: string, goal: string, guardrails?: any) {
  const response = await fetch(`${API_BASE_URL}/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, goal, guardrails }),
  });

  if (!response.ok) {
    throw new Error('Failed to create agent');
  }

  return response.json();
}

export async function getAgents(companyId?: string) {
  const url = new URL(`${API_BASE_URL}/agents`);
  if (companyId) {
    url.searchParams.set('companyId', companyId);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch agents');
  }

  return response.json();
}

export async function getAgent(agentId: string) {
  const response = await fetch(`${API_BASE_URL}/agents/${encodeURIComponent(agentId)}`);

  if (!response.ok) {
    throw new Error('Failed to fetch agent');
  }

  return response.json();
}

export async function runAgent(agentId: string) {
  const response = await fetch(`${API_BASE_URL}/agents/${encodeURIComponent(agentId)}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to run agent');
  }

  return response.json();
}

export async function updateAgent(agentId: string, updates: { status?: string; guardrails?: any }) {
  const response = await fetch(`${API_BASE_URL}/agents/${encodeURIComponent(agentId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update agent');
  }

  return response.json();
}

export async function getActivityStream(companyId: string, limit?: number) {
  const url = new URL(`${API_BASE_URL}/activity-stream`);
  url.searchParams.set('companyId', companyId);
  if (limit) {
    url.searchParams.set('limit', limit.toString());
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch activity stream');
  }

  return response.json();
}

export async function refineOpportunity(opportunityId: string, modifier: string) {
  const response = await fetch(`${API_BASE_URL}/opportunities/${encodeURIComponent(opportunityId)}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modifier }),
  });

  if (!response.ok) {
    throw new Error('Failed to refine opportunity');
  }

  return response.json();
}

export async function refineCampaignMessage(
  currentMessage: string,
  instruction: string,
  offer: string = '',
) {
  const response = await fetch(`${API_BASE_URL}/campaigns/refine-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentMessage, instruction, offer }),
  });

  if (!response.ok) {
    throw new Error('Failed to refine message');
  }

  return response.json();
}
