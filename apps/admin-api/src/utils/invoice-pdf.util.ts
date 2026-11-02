import PDFDocument from "pdfkit";

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  sellerName: string;
  sellerLegalName?: string;
  sellerAddress?: { line1?: string; city?: string; state?: string; country?: string; postalCode?: string };
  sellerGstin?: string;
  sellerCin?: string;
  sellerPan?: string;
  sellerHsnSac?: string;
  sellerEmail?: string;
  sellerLogoUrl?: string;
  sellerLogoBuffer?: Buffer;
  buyerName: string;
  buyerLegalName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: { line1?: string; city?: string; state?: string; country?: string; postalCode?: string };
  buyerGstin?: string;
  buyerPan?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number; // item-level discount amount (in currency units, e.g. Rs.)
    discountLabel?: string; // e.g. "5%" or "Flat"
    taxableAmount: number;
    amount: number;
  }>;
  currency: string;
  subtotal: number;
  itemDiscountTotal?: number; // sum of all item-level discounts
  invoiceDiscount?: number; // invoice-level discount amount
  invoiceDiscountLabel?: string; // e.g. "5%" or "Flat Rs.500"
  taxableAmount?: number;
  taxBreakdown: { cgst?: number; sgst?: number; igst?: number; totalTax: number; cgstRate?: number; sgstRate?: number; igstRate?: number };
  totalAmount: number;
  paymentMethod?: string;
  transactionId?: string;
  paymentLink?: string; // Razorpay payment link URL
  notes?: string;
}

function isSupportedImageFormat(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  return false;
}

const _logoCache = new Map<string, Buffer>();

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  let logoBuffer: Buffer | null =
    data.sellerLogoBuffer && isSupportedImageFormat(data.sellerLogoBuffer)
      ? data.sellerLogoBuffer
      : null;

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
          }
        }
      } catch {
        // Graceful degradation, no logo
      }
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ACCENT = "#1f2937"; // dark gray, matches TEXT for a clean monochrome look
    const TEXT = "#1f2937";
    const MUTED = "#6b7280";
    const LIGHT_BG = "#f8fafc";
    const BORDER = "#e2e8f0";
    const pageWidth = 595.28; // A4
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    const sym = data.currency === "INR" ? "Rs." : data.currency === "USD" ? "$" : data.currency === "EUR" ? "EUR " : data.currency + " ";
    const fmt = (n: number) => `${sym}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    // ─── HEADER: Logo + Company Name (left) | INVOICE title (right) ───
    const headerY = 45;

    if (logoBuffer) {
      doc.image(logoBuffer, margin, headerY, { fit: [140, 50] });
    }

    // INVOICE title, right aligned, black
    doc.fontSize(28).font("Helvetica-Bold").fillColor(TEXT);
    doc.text("TAX INVOICE", margin, headerY, { width: contentWidth, align: "right" });

    // ─── Org name below logo ───
    const orgNameY = headerY + 58;
    doc.fontSize(12).font("Helvetica-Bold").fillColor(TEXT);
    doc.text(data.sellerName, margin, orgNameY);

    // Seller details below org name
    doc.fontSize(9).font("Helvetica").fillColor(MUTED);
    if (data.sellerAddress?.line1) doc.text(data.sellerAddress.line1, margin);
    const sellerCityState = [data.sellerAddress?.city, data.sellerAddress?.state].filter(Boolean).join(", ");
    if (sellerCityState) doc.text(sellerCityState);
    if (data.sellerEmail) doc.text(data.sellerEmail);
    if (data.sellerGstin) doc.text(`GSTIN: ${data.sellerGstin}`);
    if (data.sellerPan) doc.text(`PAN: ${data.sellerPan}`);

    // ─── Invoice meta (right column, right-aligned under INVOICE title) ───
    const metaW = contentWidth;
    let metaY = orgNameY;

    doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT);
    doc.text("Invoice No.", margin, metaY, { width: metaW, align: "right" });
    doc.font("Helvetica").fillColor(MUTED);
    doc.text(data.invoiceNumber, margin, metaY + 12, { width: metaW, align: "right" });
    metaY += 30;

    doc.font("Helvetica-Bold").fillColor(TEXT);
    doc.text("Date", margin, metaY, { width: metaW, align: "right" });
    doc.font("Helvetica").fillColor(MUTED);
    doc.text(fmtDate(data.invoiceDate), margin, metaY + 12, { width: metaW, align: "right" });

    // ─── Divider ───
    const divY = Math.max(doc.y, metaY + 30) + 12;
    doc.moveTo(margin, divY).lineTo(pageWidth - margin, divY).lineWidth(1).stroke(BORDER);

    // ─── BILL TO section ───
    let billY = divY + 16;
    doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT).text("BILL TO", margin, billY);
    billY += 14;

    doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT);
    doc.text(data.buyerName, margin, billY);
    doc.fontSize(9).font("Helvetica").fillColor(MUTED);
    if (data.buyerEmail) doc.text(data.buyerEmail);
    if (data.buyerPhone) doc.text(data.buyerPhone);
    if (data.buyerAddress) {
      const addr = data.buyerAddress;
      if (addr.line1) doc.text(addr.line1);
      const parts = [addr.city, addr.state, addr.country].filter(Boolean).join(", ");
      if (parts) doc.text(parts);
      if (addr.postalCode) doc.text(addr.postalCode);
    }
    if (data.buyerGstin) doc.text(`GSTIN: ${data.buyerGstin}`);

    doc.moveDown(1.2);

    // ─── ITEMS TABLE ───
    const hasDiscounts = data.items.some((item) => item.discount && item.discount > 0);
    const tableTop = doc.y;
    const rowH = 24;

    // Column layout, adjust if discounts present
    const col = hasDiscounts
      ? { desc: margin, qty: 240, price: 290, disc: 370, amount: 460 }
      : { desc: margin, qty: 310, price: 380, disc: 0, amount: 470 };
    const colW = hasDiscounts
      ? { desc: 180, qty: 40, price: 70, disc: 80, amount: 85 }
      : { desc: 250, qty: 60, price: 80, disc: 0, amount: 75 };

    // Table header
    doc.rect(margin, tableTop, contentWidth, rowH).fill(ACCENT);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text("DESCRIPTION", col.desc + 10, tableTop + 7, { width: colW.desc });
    doc.text("QTY", col.qty, tableTop + 7, { width: colW.qty, align: "center" });
    doc.text("UNIT PRICE", col.price, tableTop + 7, { width: colW.price, align: "right" });
    if (hasDiscounts) {
      doc.text("DISCOUNT", col.disc, tableTop + 7, { width: colW.disc, align: "right" });
    }
    doc.text("AMOUNT", col.amount, tableTop + 7, { width: colW.amount, align: "right" });

    // Table rows
    let y = tableTop + rowH;
    doc.font("Helvetica").fontSize(9).fillColor(TEXT);

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (i % 2 === 0) {
        doc.rect(margin, y, contentWidth, rowH).fill(LIGHT_BG);
      }

      doc.fillColor(TEXT);
      doc.text(item.description, col.desc + 10, y + 7, { width: colW.desc });
      doc.text(String(item.quantity), col.qty, y + 7, { width: colW.qty, align: "center" });
      doc.text(fmt(item.unitPrice), col.price, y + 7, { width: colW.price, align: "right" });
      if (hasDiscounts) {
        if (item.discount && item.discount > 0) {
          const discText = item.discountLabel ? `-${fmt(item.discount)} (${item.discountLabel})` : `-${fmt(item.discount)}`;
          doc.fillColor("#dc2626").text(discText, col.disc, y + 7, { width: colW.disc, align: "right" });
          doc.fillColor(TEXT);
        } else {
          doc.fillColor(MUTED).text("--", col.disc, y + 7, { width: colW.disc, align: "right" });
          doc.fillColor(TEXT);
        }
      }
      doc.text(fmt(item.amount), col.amount, y + 7, { width: colW.amount, align: "right" });
      y += rowH;
    }

    // Table bottom border
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.5).stroke(BORDER);

    // ─── SUMMARY (right-aligned) ───
    y += 16;
    const sumLabelX = 350;
    const sumLabelW = 110;
    const sumValueX = col.amount;
    const sumValueW = colW.amount;

    doc.fontSize(9).font("Helvetica").fillColor(MUTED);
    doc.text("Subtotal", sumLabelX, y, { width: sumLabelW, align: "right" });
    doc.fillColor(TEXT).text(fmt(data.subtotal), sumValueX, y, { width: sumValueW, align: "right" });
    y += 18;

    // Item-level discounts
    if (data.itemDiscountTotal && data.itemDiscountTotal > 0) {
      doc.fillColor(MUTED).text("Item Discounts", sumLabelX, y, { width: sumLabelW, align: "right" });
      doc.fillColor("#dc2626").text(`-${fmt(data.itemDiscountTotal)}`, sumValueX, y, { width: sumValueW, align: "right" });
      y += 16;
    }

    // Invoice-level discount
    if (data.invoiceDiscount && data.invoiceDiscount > 0) {
      const invDiscLabel = data.invoiceDiscountLabel
        ? `Invoice Discount (${data.invoiceDiscountLabel})`
        : "Invoice Discount";
      doc.fillColor(MUTED).text(invDiscLabel, sumLabelX, y, { width: sumLabelW, align: "right" });
      doc.fillColor("#dc2626").text(`-${fmt(data.invoiceDiscount)}`, sumValueX, y, { width: sumValueW, align: "right" });
      y += 16;
    }

    // Taxable amount (if discounts applied)
    if ((data.itemDiscountTotal && data.itemDiscountTotal > 0) || (data.invoiceDiscount && data.invoiceDiscount > 0)) {
      doc.fillColor(MUTED).text("Taxable Amount", sumLabelX, y, { width: sumLabelW, align: "right" });
      doc.fillColor(TEXT).text(fmt(data.taxableAmount ?? data.subtotal), sumValueX, y, { width: sumValueW, align: "right" });
      y += 18;
    }

    if (data.taxBreakdown.cgst !== undefined) {
      const cgstLabel = `CGST (${data.taxBreakdown.cgstRate ?? 9}%)`;
      const sgstLabel = `SGST (${data.taxBreakdown.sgstRate ?? 9}%)`;
      doc.fillColor(MUTED).text(cgstLabel, sumLabelX, y, { width: sumLabelW, align: "right" });
      doc.fillColor(TEXT).text(fmt(data.taxBreakdown.cgst), sumValueX, y, { width: sumValueW, align: "right" });
      y += 16;
      doc.fillColor(MUTED).text(sgstLabel, sumLabelX, y, { width: sumLabelW, align: "right" });
      doc.fillColor(TEXT).text(fmt(data.taxBreakdown.sgst!), sumValueX, y, { width: sumValueW, align: "right" });
      y += 16;
    } else if (data.taxBreakdown.igst !== undefined) {
      const igstLabel = `IGST (${data.taxBreakdown.igstRate ?? 18}%)`;
      doc.fillColor(MUTED).text(igstLabel, sumLabelX, y, { width: sumLabelW, align: "right" });
      doc.fillColor(TEXT).text(fmt(data.taxBreakdown.igst), sumValueX, y, { width: sumValueW, align: "right" });
      y += 16;
    }

    // Total row, accent background
    y += 4;
    doc.rect(sumLabelX - 10, y, contentWidth - (sumLabelX - 10 - margin), 28).fill(ACCENT);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text("TOTAL", sumLabelX, y + 7, { width: 90, align: "right" });
    doc.text(fmt(data.totalAmount), sumValueX, y + 7, { width: sumValueW, align: "right" });
    y += 40;

    // ─── PAYMENT INFO ───
    if (data.paymentMethod || data.transactionId) {
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT).text("PAYMENT DETAILS", margin, y);
      y += 14;
      doc.font("Helvetica").fontSize(9).fillColor(MUTED);
      if (data.paymentMethod) { doc.text(`Method: ${data.paymentMethod}`, margin, y); y += 14; }
      if (data.transactionId) { doc.text(`Transaction ID: ${data.transactionId}`, margin, y); y += 14; }
      y += 8;
    }

    // ─── PAY ONLINE ───
    if (data.paymentLink) {
      y += 4;
      const btnW = 160;
      const btnH = 30;
      const btnX = margin + (contentWidth - btnW) / 2;
      doc.rect(btnX, y, btnW, btnH).fill("#16a34a"); // green
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Pay Online", btnX, y + 8, { width: btnW, align: "center" });
      doc.link(btnX, y, btnW, btnH, data.paymentLink);
      y += btnH + 8;
      doc.fontSize(7).font("Helvetica").fillColor(MUTED);
      doc.text(data.paymentLink, margin, y, { width: contentWidth, align: "center" });
      y += 16;
    }

    // ─── NOTES ───
    if (data.notes) {
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT).text("NOTES", margin, y);
      y += 14;
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(data.notes, margin, y, { width: contentWidth });
    }

    // ─── FOOTER ───
    // Footer logo (bottom-left, smaller)
    if (logoBuffer) {
      doc.image(logoBuffer, margin, 748, { fit: [70, 24] });
    }

    // Footer line
    doc.moveTo(margin, 742).lineTo(pageWidth - margin, 742).lineWidth(0.5).stroke(BORDER);

    // Footer text
    doc.font("Helvetica").fontSize(7).fillColor(MUTED);
    doc.text("This is a computer-generated invoice and does not require a signature.", margin + 80, 752, { width: contentWidth - 80, align: "center" });
    doc.text(`${data.sellerName}`, margin, 765, { width: contentWidth, align: "center" });

    doc.end();
  });
}
