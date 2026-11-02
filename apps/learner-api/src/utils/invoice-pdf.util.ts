import PDFDocument from "pdfkit";
import { getCurrencyDef } from "./currency-registry";
import logger from "./logger";

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  sellerName: string;
  sellerLegalName?: string;
  sellerAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  sellerGstin?: string;
  sellerCin?: string;
  sellerPan?: string;
  sellerHsnSac?: string;
  sellerEmail?: string;
  sellerLogoUrl?: string;
  sellerLogoBuffer?: Buffer;
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  currency: string;
  subtotal: number;
  taxBreakdown: {
    cgst?: number;
    sgst?: number;
    totalTax: number;
  };
  taxPercentage?: number;
  isIndian?: boolean;
  totalAmount: number;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
}

function formatCurrency(amount: number, currency: string): string {
  const code = String(currency ?? "").toUpperCase();
  if (code === "INR") return `\u20B9${amount.toFixed(2)}`;
  // pdfkit's built-in Helvetica is WinAnsi-encoded: ASCII plus a few currency
  // glyphs (\u20AC \u00A3 \u00A5) are safe; anything else falls back to the ISO code prefix
  // so MAD/THB/KRW amounts never render as broken glyphs.
  const symbol = getCurrencyDef(code)?.symbol ?? code;
  const winAnsiSafe = /^[\x20-\x7E\u20AC\u00A3\u00A5]+$/.test(symbol);
  const finalSymbol = winAnsiSafe ? symbol : code;
  const separator = /[A-Za-z]$/.test(finalSymbol) ? " " : "";
  return `${finalSymbol}${separator}${amount.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// pdfkit natively supports only PNG and JPEG, nothing else
function isSupportedImageFormat(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // PNG: \x89PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG: \xff\xd8\xff
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  return false;
}

const _logoCache = new Map<string, Buffer>();

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  // Validate directly-provided buffer, callers may pass WebP/SVG/GIF fetched from S3
  let logoBuffer: Buffer | null =
    data.sellerLogoBuffer && isSupportedImageFormat(data.sellerLogoBuffer)
      ? data.sellerLogoBuffer
      : null;
  if (data.sellerLogoBuffer && !logoBuffer) {
    logger.warn(`[invoice-pdf] Provided logo buffer (${data.sellerLogoBuffer.length} bytes) is not PNG/JPEG, skipping. First bytes: ${data.sellerLogoBuffer.slice(0, 4).toString("hex")}`);
  }
  if (!logoBuffer && data.sellerLogoUrl) {
    const cached = _logoCache.get(data.sellerLogoUrl);
    if (cached) {
      logoBuffer = cached;
    } else {
      try {
        const res = await fetch(data.sellerLogoUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (isSupportedImageFormat(buf)) {
            logoBuffer = buf;
            _logoCache.set(data.sellerLogoUrl, buf);
            if (_logoCache.size > 50) {
              const firstKey = _logoCache.keys().next().value;
              if (firstKey) _logoCache.delete(firstKey);
            }
          } else {
            logger.warn(`[invoice-pdf] URL-fetched logo (${buf.length} bytes) is not PNG/JPEG, skipping. URL: ${data.sellerLogoUrl}, first bytes: ${buf.slice(0, 4).toString("hex")}`);
          }
        }
      } catch {
        // Graceful degradation, no logo
      }
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100; // 50 margin each side

      // --- HEADER ---
      if (logoBuffer) {
        doc.image(logoBuffer, 50, 45, { fit: [240, 82] });
        // No hardcoded link, logo is tenant-specific
        doc.fontSize(24).font("Helvetica-Bold").fillColor("#18181b").text("TAX INVOICE", 350, 50, { align: "right" });
      } else {
        doc.fontSize(24).font("Helvetica-Bold").fillColor("#18181b").text("TAX INVOICE", 50, 50);
        doc.moveDown(0.5);
      }

      // When logo is present, start seller info below the logo with clearance
      const headerY = logoBuffer ? 142 : doc.y;

      // Seller info
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#18181b");
      doc.text(data.sellerName, 50, headerY, { width: 250 });

      doc.font("Helvetica").fontSize(9).fillColor("#52525b");
      if (data.sellerLegalName && data.sellerLegalName !== data.sellerName) {
        doc.text(data.sellerLegalName, 50, doc.y, { width: 250 });
      }
      if (data.sellerAddress) {
        const addr = data.sellerAddress;
        const parts = [addr.line1, addr.city, addr.state, addr.country, addr.postalCode].filter(Boolean);
        if (parts.length > 0) {
          doc.text(parts.join(", "), 50, doc.y, { width: 250 });
        }
      }
      if (data.sellerGstin) doc.text(`GSTIN: ${data.sellerGstin}`, 50, doc.y, { width: 250 });
      if (data.sellerPan) doc.text(`PAN: ${data.sellerPan}`, 50, doc.y, { width: 250 });
      if (data.sellerCin) doc.text(`CIN: ${data.sellerCin}`, 50, doc.y, { width: 250 });
      if (data.sellerEmail) doc.text(`Email: ${data.sellerEmail}`, 50, doc.y, { width: 250 });

      // Invoice number + date (right)
      doc.fontSize(9).font("Helvetica").fillColor("#52525b");
      doc.text(`Invoice No: ${data.invoiceNumber}`, 350, headerY, { width: 200, align: "right" });
      doc.text(`Date: ${formatDate(data.invoiceDate)}`, 350, doc.y, { width: 200, align: "right" });

      const afterHeaderY = Math.max(doc.y, headerY + 80) + 20;

      // --- BILL TO ---
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#18181b");
      doc.text("Bill To", 50, afterHeaderY);
      doc.moveDown(0.2);

      doc.fontSize(9).font("Helvetica").fillColor("#52525b");
      doc.text(data.buyerName, 50, doc.y, { width: 250 });
      doc.moveDown(0.3);
      if (data.buyerEmail) doc.text(data.buyerEmail, 50, doc.y, { width: 250 });
      if (data.buyerPhone) doc.text(data.buyerPhone, 50, doc.y, { width: 250 });
      doc.moveDown(0.3);
      if (data.buyerAddress) {
        const addr = data.buyerAddress;
        const parts = [addr.line1, addr.city, addr.state, addr.country, addr.postalCode].filter(Boolean);
        if (parts.length > 0) {
          doc.text(parts.join(", "), 50, doc.y, { width: 250 });
        }
      }

      const tableTop = doc.y + 20;

      // --- ITEMS TABLE ---
      const colDesc = 50;
      const colQty = 320;
      const colUnit = 390;
      const colAmount = 470;

      // Table header background
      doc
        .rect(50, tableTop, pageWidth, 22)
        .fill("#f4f4f5");

      doc.fontSize(9).font("Helvetica-Bold").fillColor("#18181b");
      doc.text("Description", colDesc + 8, tableTop + 6, { width: 260 });
      doc.text("Qty", colQty, tableTop + 6, { width: 60, align: "center" });
      doc.text("Unit Price", colUnit, tableTop + 6, { width: 70, align: "right" });
      doc.text("Amount", colAmount, tableTop + 6, { width: 70, align: "right" });

      let rowY = tableTop + 28;
      doc.font("Helvetica").fontSize(9).fillColor("#374151");

      for (const item of data.items) {
        doc.text(item.description, colDesc + 8, rowY, { width: 260 });
        doc.text(String(item.quantity), colQty, rowY, { width: 60, align: "center" });
        doc.text(formatCurrency(item.unitPrice, data.currency), colUnit, rowY, { width: 70, align: "right" });
        doc.text(formatCurrency(item.amount, data.currency), colAmount, rowY, { width: 70, align: "right" });
        rowY += 20;
      }

      // Separator line
      doc
        .moveTo(50, rowY + 4)
        .lineTo(50 + pageWidth, rowY + 4)
        .strokeColor("#e4e4e7")
        .lineWidth(0.5)
        .stroke();

      // --- TOTALS ---
      let totalY = rowY + 16;
      const labelX = 380;
      const valueX = 470;

      doc.fontSize(9).font("Helvetica").fillColor("#52525b");
      doc.text("Subtotal", labelX, totalY, { width: 80, align: "right" });
      doc.text(formatCurrency(data.subtotal, data.currency), valueX, totalY, { width: 70, align: "right" });
      totalY += 16;

      const pct = data.taxPercentage ?? 18;
      // GST (CGST/SGST) breakdown is INR-only; other currencies always get a
      // single "Tax (X%)" line even when the seller is an Indian tenant.
      const isIndian = data.currency === "INR" && (data.isIndian ?? true);

      if (data.taxBreakdown.totalTax > 0) {
        if (isIndian && data.taxBreakdown.cgst !== undefined && data.taxBreakdown.sgst !== undefined) {
          const halfPct = +(pct / 2).toFixed(2);
          doc.text(`CGST (${halfPct}%)`, labelX, totalY, { width: 80, align: "right" });
          doc.text(formatCurrency(data.taxBreakdown.cgst, data.currency), valueX, totalY, { width: 70, align: "right" });
          totalY += 16;
          doc.text(`SGST (${halfPct}%)`, labelX, totalY, { width: 80, align: "right" });
          doc.text(formatCurrency(data.taxBreakdown.sgst, data.currency), valueX, totalY, { width: 70, align: "right" });
          totalY += 16;
        } else if (data.taxBreakdown.totalTax > 0) {
          doc.text(`Tax (${pct}%)`, labelX, totalY, { width: 80, align: "right" });
          doc.text(formatCurrency(data.taxBreakdown.totalTax, data.currency), valueX, totalY, { width: 70, align: "right" });
          totalY += 16;
        }
      }

      if (data.sellerHsnSac) {
        doc.text(`HSN/SAC: ${data.sellerHsnSac}`, 50, totalY, { width: 200 });
      }

      // Total line
      doc
        .moveTo(labelX - 10, totalY + 2)
        .lineTo(50 + pageWidth, totalY + 2)
        .strokeColor("#18181b")
        .lineWidth(1)
        .stroke();
      totalY += 10;

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#18181b");
      doc.text("Total", labelX, totalY, { width: 80, align: "right" });
      doc.text(formatCurrency(data.totalAmount, data.currency), valueX, totalY, { width: 70, align: "right" });
      totalY += 28;

      // --- PAYMENT INFO ---
      if (data.paymentMethod || data.transactionId) {
        doc.fontSize(9).font("Helvetica").fillColor("#52525b");
        if (data.paymentMethod) {
          doc.text(`Payment Method: ${data.paymentMethod}`, 50, totalY, { width: 300 });
          totalY += 14;
        }
        if (data.transactionId) {
          doc.text(`Payment ID: ${data.transactionId}`, 50, totalY, { width: 300 });
          totalY += 14;
        }
        totalY += 10;
      }

      // --- NOTES ---
      if (data.notes) {
        doc.fontSize(9).font("Helvetica").fillColor("#71717a");
        doc.text(`Note: ${data.notes}`, 50, totalY, { width: pageWidth });
        totalY += 20;
      }

      // --- FOOTER ---
      doc
        .moveTo(50, totalY + 8)
        .lineTo(50 + pageWidth, totalY + 8)
        .strokeColor("#e4e4e7")
        .lineWidth(0.5)
        .stroke();

      doc.fontSize(8).font("Helvetica").fillColor("#a1a1aa");
      doc.text(
        "This is a computer-generated invoice and does not require a physical signature.",
        50,
        totalY + 16,
        { width: pageWidth, align: "center" }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
