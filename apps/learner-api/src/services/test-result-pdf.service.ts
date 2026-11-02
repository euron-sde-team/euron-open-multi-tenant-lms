import PDFDocument from "pdfkit";
import { Readable } from "stream";
import config from "../config";
import { db } from "../db/connection";
import testResultService, { type ResultPayload } from "./test-result.service";
import logger from "../utils/logger";
import { getTenantBaseUrl } from "../utils/tenant-domain.util";

interface TenantBranding {
  name: string;
  logoUrl: string | null;
  siteUrl: string | null;
}

async function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  try {
    const tenant = await db
      .selectFrom("tenants")
      .select(["name", "slug", "custom_domain", "certificate_logo"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    const org = await db
      .selectFrom("tenant_org_details")
      .select(["logo_light_key", "logo_dark_key"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    let logoUrl: string | null = null;
    const logoKey = org?.logo_light_key || org?.logo_dark_key;
    if (logoKey) logoUrl = `${config.TENANT_DETAILS_BASE_URL}/${logoKey}`;
    else if (tenant?.certificate_logo) logoUrl = tenant.certificate_logo;

    // Tenant's real public domain (tenant_domains primary ACTIVE), not the stale
    // tenants.custom_domain column, so the PDF footer link is correct per env.
    const siteUrl = await getTenantBaseUrl(tenantId);

    return { name: tenant?.name ?? "Test Series", logoUrl, siteUrl };
  } catch (err) {
    logger.warn("[result-pdf] tenant branding lookup failed", err);
    return { name: "Test Series", logoUrl: null, siteUrl: null };
  }
}

/** Best-effort fetch of the logo as a PNG/JPEG buffer for pdfkit (skips SVG). */
async function fetchLogo(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl || /\.svg(\?|$)/i.test(logoUrl)) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("svg")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

class TestResultPdfService {
  async generate(
    tenantId: string,
    memberId: string,
    attemptId: string
  ): Promise<Readable> {
    const result = await testResultService.getResult(tenantId, memberId, attemptId);
    const branding = await getTenantBranding(tenantId);
    const logoBuf = await fetchLogo(branding.logoUrl);

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Test Report - ${attemptId}`,
        Author: branding.name,
      },
    });
    // pdfkit's PDFDocument is also a readable stream
    const stream = doc as unknown as Readable;

    this.renderHeader(doc, branding, logoBuf);
    this.renderHero(doc, result);
    this.renderAdaptivePath(doc, result);
    this.renderSectionBreakdown(doc, result);
    this.renderTopicBreakdown(doc, result);
    this.renderAnalytics(doc, result);
    this.renderFooter(doc, branding);

    doc.end();
    return stream;
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    branding: TenantBranding,
    logoBuf: Buffer | null
  ) {
    const top = doc.y;
    let textX = 50;
    if (logoBuf) {
      try {
        doc.image(logoBuf, 50, top, { fit: [110, 44] });
        textX = 170;
      } catch {
        textX = 50;
      }
    }
    doc
      .fontSize(18)
      .fillColor("#111827")
      .text(branding.name, textX, top + (logoBuf ? 2 : 0), { lineBreak: false });
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text(
        `Test result report${branding.siteUrl ? `  ·  ${branding.siteUrl}` : ""}`,
        textX,
        top + (logoBuf ? 24 : 22),
        { lineBreak: false }
      );
    doc.y = Math.max(doc.y, top + (logoBuf ? 50 : 40));
    doc.moveDown(0.3);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);
  }

  private renderHero(doc: PDFKit.PDFDocument, r: ResultPayload) {
    const passLabel =
      r.passed === true ? " · PASSED" : r.passed === false ? " · NOT PASSED" : "";

    if (r.scaledScore !== null && r.scaledScoreMax !== null) {
      doc
        .fontSize(28)
        .fillColor("#111827")
        .text(`${r.scaledScore} / ${r.scaledScoreMax}`, { continued: true })
        .fontSize(14)
        .fillColor("#6b7280")
        .text(
          `  scaled · raw ${r.score}/${r.totalMarks} (${r.percentage.toFixed(1)}%)${passLabel}`
        );
    } else {
      doc
        .fontSize(28)
        .fillColor("#111827")
        .text(`${r.score} / ${r.totalMarks}`, { continued: true })
        .fontSize(14)
        .fillColor("#6b7280")
        .text(`  (${r.percentage.toFixed(1)}%)${passLabel}`);
    }
    doc.moveDown(0.4);

    doc.fontSize(10).fillColor("#374151");
    const cells: Array<[string, string]> = [
      ["Percentile", r.percentile !== null ? `${r.percentile.toFixed(1)}%` : "-"],
      ["Rank", r.rank !== null ? `#${r.rank}` : "-"],
      [
        "Predicted rank",
        r.predictedRankMin !== null && r.predictedRankMax !== null
          ? `${r.predictedRankMin} – ${r.predictedRankMax}`
          : "-",
      ],
      ["Submitted", fmtDate(r.submittedAt)],
    ];
    for (const [label, value] of cells) {
      doc
        .fillColor("#6b7280")
        .text(`${label}: `, { continued: true })
        .fillColor("#111827")
        .text(value);
    }
    doc.moveDown(0.8);
  }

  /** Adaptive (MST) attempts: which module 2 each section routed to. */
  private renderAdaptivePath(doc: PDFKit.PDFDocument, r: ResultPayload) {
    if (!r.adaptive || r.adaptive.sections.length === 0) return;
    this.sectionTitle(doc, "Adaptive path");
    doc.fontSize(10);
    for (const sec of r.adaptive.sections) {
      const pathLabel = sec.path
        ? sec.path
            .split(">")
            .map((v) => v.charAt(0) + v.slice(1).toLowerCase())
            .join(" > ")
        : "Single stage";
      const scaled =
        sec.scaledScore !== null && sec.scaleMax !== null
          ? ` · scaled ${sec.scaledScore}/${sec.scaleMax}`
          : "";
      doc
        .fillColor("#111827")
        .text(`${sec.sectionName}: `, { continued: true })
        .fillColor("#374151")
        .text(`Routing > ${pathLabel}${scaled}`);
      for (const m of sec.modules) {
        const variantLabel =
          m.stageNo === 1
            ? "Routing"
            : m.variant.charAt(0) + m.variant.slice(1).toLowerCase();
        doc
          .fillColor("#6b7280")
          .text(
            `    ${m.label} (${variantLabel}): ${m.rawCorrect} correct of ${m.questionCount}${m.autoCompleted ? " · auto-submitted" : ""}`
          );
      }
      const c = sec.coaching;
      if (c && c.gap !== null && c.gap > 0) {
        const ceiling =
          sec.scaleMax !== null &&
          sec.sectionCeilingMax !== null &&
          sec.sectionCeilingMax > sec.scaleMax
            ? ` This path caps at ${sec.scaleMax}; the top path reaches ${sec.sectionCeilingMax}.`
            : "";
        doc
          .fillColor("#b45309")
          .text(
            `    Module 1: ${c.module1Correct} of ${c.module1Total}. ${c.gap} more correct would have unlocked the harder module.${ceiling}`
          );
      } else if (c && c.reachedHardest) {
        doc
          .fillColor("#047857")
          .text(
            `    Module 1: ${c.module1Correct} of ${c.module1Total}. You reached the hardest module.`
          );
      }
      doc.moveDown(0.2);
    }
    doc.moveDown(0.6);
  }

  private renderSectionBreakdown(doc: PDFKit.PDFDocument, r: ResultPayload) {
    if (r.sectionBreakdown.length === 0) return;
    this.sectionTitle(doc, "Section breakdown");

    const startX = 50;
    // Widths total 495 → fits the 50..545 content box exactly.
    const cols: Array<{ key: string; w: number; align: "left" | "right" }> = [
      { key: "Section", w: 150, align: "left" },
      { key: "Attempted", w: 70, align: "right" },
      { key: "Correct", w: 65, align: "right" },
      { key: "Wrong", w: 65, align: "right" },
      { key: "Marks", w: 70, align: "right" },
      { key: "Accuracy", w: 75, align: "right" },
    ];
    const xs: number[] = [];
    let acc = startX;
    for (const c of cols) { xs.push(acc); acc += c.w; }
    const totalW = acc - startX;
    const rowH = 18;

    // Header row, each cell placed at its absolute x (no `continued`, which is
    // what previously flowed the labels inline and corrupted the layout).
    let y = doc.y;
    doc.fontSize(9).fillColor("#6b7280");
    cols.forEach((c, i) =>
      doc.text(c.key, xs[i], y, { width: c.w, align: c.align, lineBreak: false })
    );
    y += rowH - 3;
    doc.moveTo(startX, y).lineTo(startX + totalW, y).strokeColor("#e5e7eb").stroke();
    y += 5;

    doc.fontSize(9);
    for (const s of r.sectionBreakdown) {
      const cells: Array<[string, string]> = [
        [s.sectionName, "#111827"],
        [String(s.attempted), "#111827"],
        [String(s.correct), "#15803d"],
        [String(s.wrong), "#b91c1c"],
        [String(s.marks), "#111827"],
        [`${s.accuracyPct.toFixed(1)}%`, "#374151"],
      ];
      cells.forEach(([val, color], i) =>
        doc
          .fillColor(color)
          .text(val, xs[i], y, { width: cols[i].w, align: cols[i].align, lineBreak: false })
      );
      y += rowH;
    }
    doc.y = y;
    doc.moveDown(0.6);
  }

  private renderTopicBreakdown(doc: PDFKit.PDFDocument, r: ResultPayload) {
    if (r.topicBreakdown.length === 0) return;
    this.sectionTitle(doc, "Topic-wise accuracy");

    doc.fontSize(9).fillColor("#374151");
    for (const t of r.topicBreakdown) {
      doc
        .fillColor("#111827")
        .text(`${t.topic}`, 50, doc.y, { continued: true })
        .fillColor("#6b7280")
        .text(`, ${t.correctPct.toFixed(0)}% (${t.total} Q)`);
      doc.moveDown(0.2);
    }
    doc.moveDown(0.6);
  }

  private renderAnalytics(doc: PDFKit.PDFDocument, r: ResultPayload) {
    if (!r.analytics) return;
    this.sectionTitle(doc, "Advanced analytics");

    doc.fontSize(10).fillColor("#374151");
    const rows: Array<[string, string]> = [
      ["Exam readiness", `${r.analytics.examReadiness}/100`],
      ["Time efficiency", `${r.analytics.timeEfficiency}/100`],
      ["Consistency", `${r.analytics.consistency}/100`],
    ];
    if (r.analytics.topPercentileAvgScore !== null) {
      rows.push(["Top 10% avg score", String(r.analytics.topPercentileAvgScore)]);
    }
    for (const [label, value] of rows) {
      doc
        .fillColor("#6b7280")
        .text(`${label}: `, 50, doc.y, { continued: true })
        .fillColor("#111827")
        .text(value);
      doc.moveDown(0.2);
    }

    if (r.analytics.recommendations.length > 0) {
      doc.moveDown(0.4);
      doc.fillColor("#374151").fontSize(11).text("Recommendations");
      doc.moveDown(0.2);
      doc.fontSize(10);
      for (const rec of r.analytics.recommendations) {
        doc.fillColor("#111827").text(`• ${rec}`, 60, doc.y);
        doc.moveDown(0.2);
      }
    }
    doc.moveDown(0.6);
  }

  private renderFooter(doc: PDFKit.PDFDocument, branding: TenantBranding) {
    doc.moveDown();
    doc
      .fontSize(8)
      .fillColor("#9ca3af")
      .text(
        `${branding.name}${branding.siteUrl ? ` · ${branding.siteUrl}` : ""} · Generated ${new Date().toLocaleDateString()}`,
        50,
        doc.page.height - 60,
        { align: "center", width: doc.page.width - 100 }
      );
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc
      .fontSize(13)
      .fillColor("#111827")
      .text(title);
    doc.moveDown(0.3);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#f3f4f6")
      .stroke();
    doc.moveDown(0.4);
  }
}

export default new TestResultPdfService();
