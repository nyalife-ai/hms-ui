/**
 * Print an isolated HTML document (iframe) so the dashboard UI is never included.
 */

export type PrintFacility = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
};

const LOGO_PATH = "/logo-transparent.png";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function facilityHeaderHtml(facility: PrintFacility): string {
  const name = escapeHtml(facility.name || "Hospital");
  const bits = [facility.address, facility.phone, facility.email]
    .map((v) => v?.trim())
    .filter(Boolean)
    .map((v) => escapeHtml(v as string));
  return `
    <div class="header">
      <img class="logo" src="${LOGO_PATH}" alt="" />
      <div class="brand">
        <div class="name">${name}</div>
        ${bits.length ? `<div class="meta">${bits.join(" · ")}</div>` : ""}
      </div>
    </div>
  `;
}

export function printIsolatedDocument(input: {
  title: string;
  bodyHtml: string;
  facility: PrintFacility;
}): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  const origin = window.location.origin;
  const logoUrl = `${origin}${LOGO_PATH}`;

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    @page { margin: 14mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1a1220;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .logo {
      width: 72px;
      height: 72px;
      object-fit: contain;
    }
    .brand .name {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand .meta {
      margin-top: 2px;
      color: #6b7280;
      font-size: 11px;
    }
    .doc-title {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 16px;
      margin-bottom: 16px;
    }
    .label {
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .value { font-weight: 600; font-size: 12px; }
    .muted { color: #6b7280; font-weight: 400; font-size: 11px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px;
    }
    th, td {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: top;
    }
    th {
      color: #9ca3af;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    td.num, th.num { text-align: right; }
    .totals {
      margin-left: auto;
      width: 220px;
      text-align: right;
    }
    .totals .row { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; }
    .totals .grand { font-size: 14px; font-weight: 700; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; }
    .footer {
      margin-top: 24px;
      color: #9ca3af;
      font-size: 10px;
      text-align: center;
    }
  </style>
</head>
<body>
  ${input.bodyHtml.replace(LOGO_PATH, logoUrl)}
</body>
</html>`);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    return;
  }

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* already removed */
    }
  };

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      window.setTimeout(cleanup, 800);
    }
  };

  // Wait for logo image so it appears on the sheet
  const imgs = Array.from(doc.images);
  if (imgs.length === 0) {
    window.setTimeout(runPrint, 50);
    return;
  }
  let pending = imgs.length;
  const done = () => {
    pending -= 1;
    if (pending <= 0) runPrint();
  };
  imgs.forEach((img) => {
    if (img.complete) done();
    else {
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    }
  });
  window.setTimeout(runPrint, 1500);
}
