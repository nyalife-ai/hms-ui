/**
 * Laboratory report PDF — NyaLife-themed pathology layout.
 * Body: Investigation tables (PARAMETER / RESULT / UNIT / REFERENCE RANGE),
 * Clinical Observations + Professional Conclusion summary cards,
 * Laboratory Technician signature. Footer QR only (no top QR/barcode/ISO).
 */

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { HospitalSettings } from "@/lib/hospital";
import {
  getLabReportConfig,
  type LabReportConfig,
} from "@/lib/lab-report-config";
import type { LabRequestDetail, LabResultLine } from "@/lib/lab-types";
import { statusLabel } from "@/lib/lab-types";
import { humanReadableClinicalNotes } from "@/lib/clinical-notes-display";

const BRAND = {
  primary: [217, 26, 102] as const,
  primarySoft: [255, 241, 246] as const,
  text: [26, 18, 32] as const,
  muted: [100, 116, 139] as const,
  line: [226, 232, 240] as const,
  tableHead: [241, 245, 249] as const,
  flag: [2, 132, 199] as const,
  border: [203, 213, 225] as const,
  cardBg: [252, 250, 251] as const,
};

function rgb(c: readonly [number, number, number]) {
  return { r: c[0], g: c[1], b: c[2] };
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function flagFor(interp: string | null): string {
  if (interp === "HIGH" || interp === "CRITICAL") return "H";
  if (interp === "LOW") return "L";
  return "";
}

function doctorLabel(name: string | null | undefined): string {
  if (!name?.trim()) return "Self";
  const cleaned = name.replace(/^Dr\.?\s*/i, "").trim();
  return cleaned ? `Dr. ${cleaned}` : "Self";
}

function groupByPanel(results: LabResultLine[]): Map<string, LabResultLine[]> {
  const map = new Map<string, LabResultLine[]>();
  for (const r of results) {
    const key = r.testName || "Laboratory investigations";
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo-transparent.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "") || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function presentPdfInBrowser(blob: Blob, title: string): void {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* ignore */
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 180_000);
    return;
  }

  const existing = document.getElementById("nyalife-lab-pdf-preview");
  existing?.remove();
  const overlay = document.createElement("div");
  overlay.id = "nyalife-lab-pdf-preview";
  overlay.setAttribute(
    "style",
    "position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;flex-direction:column;padding:16px;",
  );
  const bar = document.createElement("div");
  bar.setAttribute(
    "style",
    "display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;",
  );
  const label = document.createElement("span");
  label.textContent = title;
  label.setAttribute("style", "color:#fff;font:600 13px system-ui,sans-serif;");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.setAttribute(
    "style",
    "border:0;border-radius:999px;background:#fff;color:#1a1220;padding:8px 14px;font:600 12px system-ui,sans-serif;cursor:pointer;",
  );
  close.onclick = () => {
    overlay.remove();
    URL.revokeObjectURL(url);
  };
  bar.append(label, close);
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = title;
  frame.setAttribute(
    "style",
    "flex:1;width:100%;border:0;border-radius:12px;background:#fff;",
  );
  overlay.append(bar, frame);
  document.body.appendChild(overlay);
}

export type LabReportPrintInput = {
  detail: LabRequestDetail;
  hospital: HospitalSettings;
  config?: LabReportConfig;
  verifyBaseUrl?: string;
};

export async function buildLabReportPdf(
  input: LabReportPrintInput,
): Promise<jsPDF> {
  const config = input.config ?? getLabReportConfig();
  const { detail, hospital } = input;
  const origin =
    input.verifyBaseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const reportId =
    detail.requestNumber || detail.id.slice(0, 8).toUpperCase();
  const verifyUrl = `${origin}/laboratory/results/${detail.id}?verify=1&ref=${encodeURIComponent(reportId)}`;

  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(verifyUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#1a1220", light: "#ffffff" },
    }),
    loadLogoDataUrl(),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentW = pageW - marginX * 2;
  const footerH = 36;
  let y = 10;

  const setPrimary = () => {
    const c = rgb(BRAND.primary);
    doc.setTextColor(c.r, c.g, c.b);
  };
  const setText = () => {
    const c = rgb(BRAND.text);
    doc.setTextColor(c.r, c.g, c.b);
  };
  const setMuted = () => {
    const c = rgb(BRAND.muted);
    doc.setTextColor(c.r, c.g, c.b);
  };

  const drawPageChrome = () => {
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.35);
    doc.rect(6, 6, pageW - 12, pageH - 12);

    if (logoDataUrl) {
      try {
        const GState = (doc as unknown as {
          GState?: new (opts: { opacity: number }) => unknown;
        }).GState;
        const setGState = (doc as unknown as { setGState?: (g: unknown) => void })
          .setGState;
        doc.saveGraphicsState();
        if (GState && setGState) setGState(new GState({ opacity: 0.07 }));
        const wm = 70;
        doc.addImage(
          logoDataUrl,
          "PNG",
          (pageW - wm) / 2,
          (pageH - wm) / 2 - 10,
          wm,
          wm,
        );
        doc.restoreGraphicsState();
      } catch {
        /* ignore */
      }
    }
  };

  const drawFooter = () => {
    const fy = pageH - footerH;
    doc.setFillColor(...BRAND.primary);
    doc.rect(marginX, fy, contentW, 0.9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setPrimary();
    doc.text(config.emergencyNote, marginX, fy + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setMuted();
    const clinical = doc.splitTextToSize(
      config.clinicalDisclaimer,
      contentW - 28,
    );
    doc.text(clinical, marginX, fy + 10);
    const eSigY = fy + 10 + clinical.length * 2.8 + 1.5;
    const eSig = doc.splitTextToSize(
      config.electronicSignatureNote,
      contentW - 28,
    );
    doc.text(eSig, marginX, eSigY);

    try {
      doc.addImage(qrDataUrl, "PNG", pageW - marginX - 16, fy + 8, 14, 14);
    } catch {
      /* ignore */
    }

    const page = doc.getCurrentPageInfo().pageNumber;
    const total = doc.getNumberOfPages();
    doc.setFontSize(7);
    setMuted();
    doc.text(`${page} / ${total}`, pageW - marginX, fy - 2, { align: "right" });
  };

  const ensureSpace = (need: number) => {
    if (y + need < pageH - footerH - 4) return;
    drawFooter();
    doc.addPage();
    drawPageChrome();
    y = 12;
  };

  drawPageChrome();

  // ── Header (logo + facility only — no ISO / accreditation) ──
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", marginX, y - 1, 16, 16);
    } catch {
      /* ignore */
    }
  }
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  setPrimary();
  doc.text(hospital.name || "NyaLife", marginX + 18, y + 5);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  setMuted();
  doc.text(config.tagline, marginX + 18, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText();
  if (hospital.address?.trim()) {
    doc.text(hospital.address.trim(), marginX + 18, y + 14.5);
  }
  y += 20;

  // Contact ribbon
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, pageW - marginX, y);
  y += 1.2;
  doc.setFillColor(...BRAND.primarySoft);
  doc.rect(marginX, y, contentW, 7, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText();
  const contact = [
    hospital.email ? `✉  ${hospital.email}` : null,
    hospital.phone ? `☎  ${hospital.phone}` : null,
    `◷  ${config.hours}`,
  ]
    .filter(Boolean)
    .join("     |     ");
  doc.text(contact, marginX + 3, y + 4.6);
  y += 11;

  // ── Patient meta (no top QR / barcode) ──
  const leftMeta: Array<[string, string]> = [
    ["Name", detail.patientName],
    [
      "Age/Gender",
      [
        detail.patientAge > 0 ? `${detail.patientAge} Years` : null,
        detail.patientGender || null,
      ]
        .filter(Boolean)
        .join("/") || "—",
    ],
    ["Referred By", doctorLabel(detail.requestingDoctor)],
    ["Phone No.", detail.patientPhone || "—"],
    ["Report ID", reportId],
  ];
  const rightMeta: Array<[string, string]> = [
    ["Registration Date", fmtDateTime(detail.requestDate)],
    [
      "Received Date",
      fmtDateTime(detail.samples[0]?.collectedAt || detail.createdAt),
    ],
    ["Report Date", fmtDateTime(detail.updatedAt)],
    [
      "Report Status",
      detail.status === "COMPLETED" ? "Final" : statusLabel(detail.status),
    ],
    ["MRN", detail.mrn || "—"],
  ];

  const metaTop = y;
  leftMeta.forEach((row, i) => {
    const yy = metaTop + i * 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText();
    doc.text(row[0], marginX, yy);
    doc.setFont("helvetica", "normal");
    doc.text(`:  ${row[1]}`, marginX + 28, yy);
  });
  const midX = marginX + contentW * 0.5;
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.2);
  doc.line(midX - 2, metaTop - 2, midX - 2, metaTop + 24);
  rightMeta.forEach((row, i) => {
    const yy = metaTop + i * 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText();
    doc.text(row[0], midX + 2, yy);
    doc.setFont("helvetica", "normal");
    doc.text(`:  ${row[1]}`, midX + 36, yy);
  });
  y = metaTop + 28;

  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageW - marginX, y);
  y += 7;

  // ── Investigation tables ──
  const panels = groupByPanel(detail.results);
  if (panels.size === 0) {
    doc.setFontSize(10);
    setMuted();
    doc.text("No results recorded for this request.", marginX, y);
    y += 8;
  }

  const colX = {
    param: marginX + 2,
    result: marginX + contentW * 0.38,
    unit: marginX + contentW * 0.58,
    ref: marginX + contentW * 0.72,
  };

  for (const [panelName, lines] of panels) {
    ensureSpace(20 + lines.length * 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText();
    doc.text(`Investigation: ${panelName}`, marginX, y);
    y += 6;

    doc.setFillColor(...BRAND.tableHead);
    doc.rect(marginX, y, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText();
    doc.text("PARAMETER", colX.param, y + 4.6);
    doc.text("RESULT", colX.result, y + 4.6);
    doc.text("UNIT", colX.unit, y + 4.6);
    doc.text("REFERENCE RANGE", colX.ref, y + 4.6);
    y += 9;

    for (const line of lines) {
      ensureSpace(10);
      const name = line.parameterName || "Parameter";
      const value = line.resultValue || "—";
      const unit = line.unitOfMeasurement?.trim() || "—";
      const ref = line.normalReferenceRange || "—";
      const flag = flagFor(line.interpretation);
      const out = Boolean(flag);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setText();
      doc.text(name, colX.param, y);

      doc.setFont("helvetica", out ? "bold" : "normal");
      if (out) doc.setTextColor(...BRAND.flag);
      else setText();
      doc.text(out ? `${value}  ${flag}` : value, colX.result, y);

      doc.setFont("helvetica", "normal");
      setMuted();
      doc.text(unit, colX.unit, y);
      const refLines = doc.splitTextToSize(ref, contentW * 0.26);
      doc.text(refLines, colX.ref, y);

      y += Math.max(5.5, refLines.length * 3.5);
      doc.setDrawColor(...BRAND.line);
      doc.setLineWidth(0.12);
      doc.line(marginX, y - 1.5, pageW - marginX, y - 1.5);
    }
    y += 5;
  }

  // ── Summary cards: Clinical Observations + Professional Conclusion ──
  const observations = detail.observations?.trim() || "—";
  const conclusion = detail.conclusion?.trim() || "—";
  ensureSpace(42);

  const drawSummaryCard = (title: string, body: string) => {
    const bodyLines = doc.splitTextToSize(body, contentW - 8);
    const cardH = 8 + bodyLines.length * 3.6 + 4;
    ensureSpace(cardH + 4);
    doc.setFillColor(...BRAND.cardBg);
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.25);
    doc.roundedRect(marginX, y, contentW, cardH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setPrimary();
    doc.text(title, marginX + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText();
    doc.text(bodyLines, marginX + 4, y + 11);
    y += cardH + 4;
  };

  drawSummaryCard("Clinical Observations", observations);
  drawSummaryCard("Professional Conclusion", conclusion);

  const readableNotes = humanReadableClinicalNotes(detail.notes);
  if (readableNotes) {
    drawSummaryCard("Clinical notes", readableNotes);
  }

  // ── Laboratory Technician Signature (+ ordering dept / verifier) ──
  ensureSpace(32);
  y += 2;
  const techRaw =
    detail.results.find((r) => r.performedByEmail)?.performedByEmail?.split(
      "@",
    )[0] || "Lab Technician";
  const techName = techRaw
    .replace(/\./g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const orderingDept =
    detail.requestingDoctorDepartment ||
    detail.requestingDoctorSpecialization ||
    "Clinical Department";
  const orderingName = doctorLabel(detail.requestingDoctor);
  const verifierRaw =
    detail.results.find((r) => r.verifiedByEmail)?.verifiedByEmail?.split(
      "@",
    )[0] || "";
  const verifierName = verifierRaw
    ? verifierRaw.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";

  const sigs = [
    {
      name: techName,
      title: "Laboratory Technician Signature",
      sub: "Laboratory Technologist",
    },
    {
      name: orderingName,
      title: orderingDept,
      sub: "Ordering physician · Department",
    },
    {
      name: verifierName,
      title: "Verified By",
      sub: "Result verification",
    },
  ];
  const sigW = contentW / 3;
  sigs.forEach((sig, i) => {
    const sx = marginX + i * sigW;
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.35);
    doc.line(sx + 4, y, sx + sigW - 8, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText();
    doc.text(sig.name, sx + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setMuted();
    doc.text(sig.title, sx + 4, y + 9);
    doc.text(sig.sub, sx + 4, y + 12.5);
  });

  drawFooter();

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setMuted();
    doc.setFillColor(255, 255, 255);
    doc.rect(pageW - marginX - 14, pageH - footerH - 6, 14, 4, "F");
    doc.text(`${p} / ${totalPages}`, pageW - marginX, pageH - footerH - 2, {
      align: "right",
    });
  }

  return doc;
}

export async function openLabReportPdf(
  input: LabReportPrintInput,
): Promise<void> {
  const placeholder =
    typeof window !== "undefined"
      ? window.open("about:blank", "_blank")
      : null;
  try {
    const doc = await buildLabReportPdf(input);
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const title = `${input.detail.requestNumber || "Lab"} report`;
    if (placeholder) {
      try {
        placeholder.opener = null;
      } catch {
        /* ignore */
      }
      placeholder.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 180_000);
      return;
    }
    presentPdfInBrowser(blob, title);
  } catch (err) {
    placeholder?.close();
    throw err;
  }
}

export async function printLabReportPdf(
  input: LabReportPrintInput,
): Promise<void> {
  const placeholder =
    typeof window !== "undefined"
      ? window.open("about:blank", "_blank")
      : null;
  try {
    const doc = await buildLabReportPdf(input);
    doc.autoPrint();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const title = `${input.detail.requestNumber || "Lab"} report`;
    if (placeholder) {
      try {
        placeholder.opener = null;
      } catch {
        /* ignore */
      }
      placeholder.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 180_000);
      return;
    }
    presentPdfInBrowser(blob, title);
  } catch (err) {
    placeholder?.close();
    throw err;
  }
}
