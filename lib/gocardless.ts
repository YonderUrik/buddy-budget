const GC_BASE_URL = process.env.GC_BASE_URL || "https://bankaccountdata.gocardless.com/api/v2";

export type GoCardlessTokenResponse = {
  access: string;
  access_expires: number;
  refresh: string;
  refresh_expires: number;
};

export async function gcGetAccessToken(): Promise<string> {
  const secretId = process.env.GC_SECRET_ID;
  const secretKey = process.env.GC_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error("Missing GC_SECRET_ID or GC_SECRET_KEY env vars");
  }
  const res = await fetch(`${GC_BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to obtain GoCardless token: ${res.status} ${text}`);
  }
  const data = (await res.json()) as GoCardlessTokenResponse;
  return data.access;
}

export async function gcListInstitutions(country: string) {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/institutions/?country=${encodeURIComponent(country)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list institutions: ${res.status} ${text}`);
  }
  return res.json();
}

export async function gcGetInstitution(institutionId: string) {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/institutions/${encodeURIComponent(institutionId)}/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get institution: ${res.status} ${text}`);
  }
  return res.json();
}

export async function gcCreateRequisition(params: { redirect: string; institutionId: string; reference?: string; agreement?: string }) {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/requisitions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      redirect: params.redirect,
      institution_id: params.institutionId,
      reference: params.reference ?? undefined,
      agreement: params.agreement ?? undefined,
    }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create requisition: ${res.status} ${text}`);
  }

  return res.json();
}

export async function gcGetRequisition(requisitionId: string) {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/requisitions/${encodeURIComponent(requisitionId)}/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get requisition: ${res.status} ${text}`);
  }

  return res.json();
}

export async function gcGetAccountDetails(accountId: string) {
  const token = await gcGetAccessToken();
  const [detailsRes, balancesRes] = await Promise.all([
    fetch(`${GC_BASE_URL}/accounts/${encodeURIComponent(accountId)}/details/`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    fetch(`${GC_BASE_URL}/accounts/${encodeURIComponent(accountId)}/balances/`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
  ]);
  if (!detailsRes.ok) {
    const text = await detailsRes.text();
    throw new Error(`Failed to get account details: ${detailsRes.status} ${text}`);
  }
  if (!balancesRes.ok) {
    const text = await balancesRes.text();
    throw new Error(`Failed to get account balances: ${balancesRes.status} ${text}`);
  }
  const details = await detailsRes.json();
  const balances = await balancesRes.json();
  return { details, balances };
}

export async function gcGetAccountTransactions(accountId: string, dateFrom?: string, dateTo?: string) {
  const token = await gcGetAccessToken();
  
  // Build query parameters
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const url = `${GC_BASE_URL}/accounts/${encodeURIComponent(accountId)}/transactions/${queryString}`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get account transactions: ${res.status} ${text}`);
  }

  const result = await res.json();
  return result;
}

export async function gcListRequisitions() {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/requisitions/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list requisitions: ${res.status} ${text}`);
  }

  return res.json();
}

export async function gcDeleteRequisition(requisitionId: string) {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/requisitions/${encodeURIComponent(requisitionId)}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete requisition: ${res.status} ${text}`);
  }

  return res.status === 204; // Successful deletion returns 204 No Content
}

export async function gcListAgreements() {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/agreements/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list agreements: ${res.status} ${text}`);
  }

  return res.json();
}

export async function gcDeleteAgreement(agreementId: string) {
  const token = await gcGetAccessToken();
  const res = await fetch(`${GC_BASE_URL}/agreements/${encodeURIComponent(agreementId)}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete agreement: ${res.status} ${text}`);
  }

  return res.status === 204; // Successful deletion returns 204 No Content
}

export type GoCardlessTransaction = {
  transactionId: string;
  entryReference?: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  merchantCategoryCode?: string;
  proprietaryBankTransactionCode?: string;
  internalTransactionId?: string;
};


