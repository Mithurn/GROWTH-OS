const API_BASE_URL = 'http://localhost:3001/api';

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
