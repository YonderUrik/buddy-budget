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
  console.log("TOKEN", data.access);
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

export async function gcCreateAgreement(institutionId: string, accessValidForDays: number = 90) {
  const token = await gcGetAccessToken();

  // Fetch institution to determine allowed historical days window
  const institutionRes = await fetch(`${GC_BASE_URL}/institutions/${encodeURIComponent(institutionId)}/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!institutionRes.ok) {
    const text = await institutionRes.text();
    throw new Error(`Failed to get institution: ${institutionRes.status} ${text}`);
  }
  const institution = await institutionRes.json();
  const transactionTotalDays: number = typeof institution?.transaction_total_days === "number" ? institution.transaction_total_days : 90;
  const maxHistoricalDays = Math.min(transactionTotalDays, 90);

  const res = await fetch(`${GC_BASE_URL}/agreements/enduser/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      institution_id: institutionId,
      max_historical_days: maxHistoricalDays,
      access_valid_for_days: accessValidForDays,
      access_scope: ["balances", "details", "transactions"],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create agreement: ${res.status} ${text}`);
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
      user_language: "en",
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


