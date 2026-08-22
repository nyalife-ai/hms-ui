/**
 * Bulk import API helpers — validate / commit / template downloads.
 */

import { API_URL, ApiError, getAccessToken } from "./api";

export type BulkImportIssue = {
  row: number;
  message: string;
  field?: string;
  value?: string;
};

export type BulkImportPreview = {
  sessionId: string;
  resource: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  canCommit: boolean;
  errors: BulkImportIssue[];
  warnings: BulkImportIssue[];
  previewSample: Array<Record<string, string | undefined>>;
  expiresInMinutes: number;
};

export type BulkImportCommitResult = {
  resource: string;
  imported: number;
  failed: number;
  skipped: number;
  errors: BulkImportIssue[];
  createdIds: string[];
};

async function authHeaders(): Promise<Headers> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // ignore
  }
  return res.statusText || "Request failed";
}

export async function downloadBulkImportFile(
  resource: string,
  kind: "template" | "example",
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/bulk-imports/${resource}/${kind}`, {
    headers,
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${resource}-${kind}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadBulkImportErrors(
  resource: string,
  sessionId: string,
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(
    `${API_URL}/bulk-imports/${resource}/sessions/${sessionId}/errors.csv`,
    { headers },
  );
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${resource}-import-errors.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function validateBulkImport(
  resource: string,
  file: File,
): Promise<BulkImportPreview> {
  const headers = await authHeaders();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/bulk-imports/${resource}/validate`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json() as Promise<BulkImportPreview>;
}

export async function commitBulkImport(
  resource: string,
  sessionId: string,
): Promise<BulkImportCommitResult> {
  const headers = await authHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_URL}/bulk-imports/${resource}/commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json() as Promise<BulkImportCommitResult>;
}
