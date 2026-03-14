const prisma = require("../prisma");
const puppeteer = require("puppeteer");

// Helper: Convert number to words (Indian system)
function numberToWords(num) {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  if (num === 0) return "Zero";

  function convert(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = convert(intPart) + " Rupees";
  if (decPart > 0) result += " And " + convert(decPart) + " Paise";
  result += " Only";
  return result;
}

const toJson = (value, fallback) =>
  JSON.parse(JSON.stringify(value ?? fallback));

// Helper: Compute derived totals and line item fields
const computeInvoiceData = (data) => {
  let subTotal = 0;
  const lineItems = (data.lineItems || []).map((item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const taxableAmount = qty * rate;
    const gstRate = (Number(item.gstPercent) || 0) / 100;
    const cgst = parseFloat((taxableAmount * gstRate * 0.5).toFixed(2));
    const sgst = parseFloat((taxableAmount * gstRate * 0.5).toFixed(2));
    const igst = parseFloat((taxableAmount * gstRate).toFixed(2));
    const amount = parseFloat((taxableAmount + igst).toFixed(2));
    subTotal += taxableAmount;
    return { ...item, qty, rate, gstPercent: Number(item.gstPercent) || 0, taxableAmount, cgst, sgst, igst, amount };
  });

  const discountPercent = Number(data.discountPercent) || 0;
  const discountAmount = parseFloat(((subTotal * discountPercent) / 100).toFixed(2));
  const taxableAmount = parseFloat((subTotal - discountAmount).toFixed(2));

  // Determine if inter-state (IGST) or intra-state (CGST+SGST)
  const isInterState =
    (data.billedBy?.state || "").toLowerCase() !==
    (data.placeOfSupply || "").toLowerCase();

  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  const discountFactor = 1 - discountPercent / 100;
  lineItems.forEach((item) => {
    if (isInterState) {
      totalIGST += item.igst * discountFactor;
    } else {
      totalCGST += item.cgst * discountFactor;
      totalSGST += item.sgst * discountFactor;
    }
  });
  totalCGST = parseFloat(totalCGST.toFixed(2));
  totalSGST = parseFloat(totalSGST.toFixed(2));
  totalIGST = parseFloat(totalIGST.toFixed(2));

  const grandTotal = parseFloat(
    (taxableAmount + totalCGST + totalSGST + totalIGST).toFixed(2)
  );
  const totalInWords = numberToWords(grandTotal);

  const earlyPayDiscount = Number(data.earlyPayDiscount) || 0;
  const earlyPayAmount = parseFloat((grandTotal - earlyPayDiscount).toFixed(2));

  return {
    lineItems,
    subTotal: parseFloat(subTotal.toFixed(2)),
    discountPercent,
    discountAmount,
    taxableAmount,
    totalCGST,
    totalSGST,
    totalIGST,
    grandTotal,
    totalInWords,
    earlyPayDiscount,
    earlyPayAmount,
  };
};

// CREATE Invoice
const createInvoice = async (req, res) => {
  try {
    const data = req.body;
    const computed = computeInvoiceData(data);

    const saved = await prisma.invoice.create({
      data: {
        ...data,
        ...computed,
        userId: req.user.id,
        billedBy: toJson(data.billedBy, {}),
        billedTo: toJson(data.billedTo, {}),
        bankDetails: toJson(data.bankDetails, {}),
        lineItems: toJson(computed.lineItems, []),
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        earlyPayDate: data.earlyPayDate ? new Date(data.earlyPayDate) : null,
      },
    });
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ success: false, message: "Invoice number already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET All Invoices
const getAllInvoices = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status, userId: req.user.id } : { userId: req.user.id };
    const take = parseInt(limit);
    const skip = (page - 1) * take;
    const invoices = await prisma.invoice.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        billedTo: true,
        grandTotal: true,
        status: true,
        createdAt: true,
      },
    });
    const total = await prisma.invoice.count({ where: filter });
    res.json({ success: true, data: invoices, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET Single Invoice
const getInvoice = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE Invoice (recompute totals server-side)
const updateInvoice = async (req, res) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Invoice not found" });

    const data = req.body || {};
    const merged = {
      ...existing,
      ...data,
      billedBy: { ...(existing.billedBy || {}), ...(data.billedBy || {}) },
      billedTo: { ...(existing.billedTo || {}), ...(data.billedTo || {}) },
      bankDetails: { ...(existing.bankDetails || {}), ...(data.bankDetails || {}) },
      lineItems: Array.isArray(data.lineItems) ? data.lineItems : existing.lineItems,
    };

    const computed = computeInvoiceData(merged);
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        ...merged,
        ...computed,
        billedBy: toJson(merged.billedBy, {}),
        billedTo: toJson(merged.billedTo, {}),
        bankDetails: toJson(merged.bankDetails, {}),
        lineItems: toJson(computed.lineItems, []),
        invoiceDate: merged.invoiceDate ? new Date(merged.invoiceDate) : null,
        dueDate: merged.dueDate ? new Date(merged.dueDate) : null,
        earlyPayDate: merged.earlyPayDate ? new Date(merged.earlyPayDate) : null,
      },
    });
    res.json({ success: true, data: invoice });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ success: false, message: "Invoice number already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE Invoice
const deleteInvoice = async (req, res) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Invoice not found" });
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Invoice deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE Status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Invoice not found" });
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ success: true, data: invoice });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// GENERATE PDF HTML (returned as HTML for client-side printing or puppeteer)
const generateInvoiceHTML = (invoice) => {
  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0);
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  const rows = (invoice.lineItems || [])
    .map(
      (item, i) => `
    <tr>
      <td>${i + 1}. ${item.description}</td>
      <td>${item.hsn || "-"}</td>
      <td>${item.qty}</td>
      <td>${item.gstPercent || 0}%</td>
      <td>₹${fmt(item.taxableAmount)}</td>
      <td>₹${fmt(item.sgst)}</td>
      <td>₹${fmt(item.cgst)}</td>
      <td>₹${fmt(item.amount)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .invoice-title { font-size: 32px; font-weight: 800; color: #7c3aed; letter-spacing: -1px; }
  .meta { margin-top: 10px; line-height: 1.8; }
  .meta span { font-weight: 700; }
  .logo-box { background: #1a1a2e; color: #fff; padding: 14px 20px; font-size: 18px; font-weight: 900; border-radius: 4px; letter-spacing: 1px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .party-box { background: #f5f3ff; border-radius: 8px; padding: 16px; }
  .party-box h4 { color: #7c3aed; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
  .party-box p { line-height: 1.7; color: #374151; }
  .supply-row { display: flex; justify-content: space-between; background: #faf9ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #7c3aed; color: #fff; }
  thead th { padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; }
  tbody tr { border-bottom: 1px solid #f3f4f6; }
  tbody tr:hover { background: #faf9ff; }
  tbody td { padding: 10px 12px; }
  .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .bank-box h4 { color: #7c3aed; font-weight: 700; margin-bottom: 10px; }
  .bank-row { display: flex; gap: 12px; margin-bottom: 4px; }
  .bank-label { color: #6b7280; width: 140px; flex-shrink: 0; }
  .totals { }
  .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
  .total-row.grand { font-size: 18px; font-weight: 800; color: #1a1a2e; border-top: 2px solid #1a1a2e; border-bottom: none; padding-top: 10px; }
  .total-row.discount { color: #10b981; }
  .total-row.early { color: #f59e0b; }
  .words { font-size: 12px; color: #6b7280; margin: 4px 0 12px; }
  .terms { margin-top: 20px; }
  .terms h4 { color: #7c3aed; font-weight: 700; margin-bottom: 8px; }
  .terms p, .terms li { color: #374151; line-height: 1.7; font-size: 12px; }
  .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #6b7280; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
    background: ${invoice.status === "paid" ? "#d1fae5" : invoice.status === "overdue" ? "#fee2e2" : "#ede9fe"};
    color: ${invoice.status === "paid" ? "#065f46" : invoice.status === "overdue" ? "#991b1b" : "#5b21b6"}; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="invoice-title">Invoice</div>
    <div class="meta">
      Invoice# &nbsp;&nbsp;<span>${invoice.invoiceNumber}</span><br/>
      Invoice Date &nbsp;&nbsp;<span>${fmtDate(invoice.invoiceDate)}</span><br/>
      Due Date &nbsp;&nbsp;<span>${fmtDate(invoice.dueDate)}</span><br/>
      Status &nbsp;&nbsp;<span class="status-badge">${invoice.status}</span>
    </div>
  </div>
  <div class="logo-box">${invoice.billedBy?.name || "COMPANY"}</div>
</div>

<div class="parties">
  <div class="party-box">
    <h4>Billed by</h4>
    <p><strong>${invoice.billedBy?.name}</strong><br/>
    ${invoice.billedBy?.address}<br/>
    ${invoice.billedBy?.city}${invoice.billedBy?.city ? ", " : ""}${invoice.billedBy?.state}${invoice.billedBy?.pincode ? " - " + invoice.billedBy?.pincode : ""}<br/>
    ${invoice.billedBy?.gstin ? "GSTIN: " + invoice.billedBy.gstin : ""}<br/>
    ${invoice.billedBy?.pan ? "PAN: " + invoice.billedBy.pan : ""}</p>
  </div>
  <div class="party-box">
    <h4>Billed to</h4>
    <p><strong>${invoice.billedTo?.name}</strong><br/>
    ${invoice.billedTo?.address}<br/>
    ${invoice.billedTo?.city}${invoice.billedTo?.city ? ", " : ""}${invoice.billedTo?.state}${invoice.billedTo?.pincode ? " - " + invoice.billedTo?.pincode : ""}<br/>
    ${invoice.billedTo?.gstin ? "GSTIN: " + invoice.billedTo.gstin : ""}<br/>
    ${invoice.billedTo?.pan ? "PAN: " + invoice.billedTo.pan : ""}</p>
  </div>
</div>

<div class="supply-row">
  <div>Place of Supply &nbsp; <strong>${invoice.placeOfSupply}</strong></div>
  <div>Country of Supply &nbsp; <strong>${invoice.countryOfSupply}</strong></div>
</div>

<table>
  <thead>
    <tr>
      <th>Item # / Item Description</th>
      <th>HSN</th>
      <th>Qty.</th>
      <th>GST</th>
      <th>Taxable Amount</th>
      <th>SGST</th>
      <th>CGST</th>
      <th>Amount</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="bottom">
  <div>
    ${invoice.bankDetails?.accountNumber ? `
    <div class="bank-box">
      <h4>Bank &amp; Payment Details</h4>
      <div class="bank-row"><span class="bank-label">Account Holder</span><span>${invoice.bankDetails.accountHolderName}</span></div>
      <div class="bank-row"><span class="bank-label">Account Number</span><span>${invoice.bankDetails.accountNumber}</span></div>
      <div class="bank-row"><span class="bank-label">IFSC</span><span>${invoice.bankDetails.ifsc}</span></div>
      <div class="bank-row"><span class="bank-label">Account Type</span><span>${invoice.bankDetails.accountType}</span></div>
      <div class="bank-row"><span class="bank-label">Bank</span><span>${invoice.bankDetails.bankName}</span></div>
      ${invoice.bankDetails.upi ? `<div class="bank-row"><span class="bank-label">UPI</span><span>${invoice.bankDetails.upi}</span></div>` : ""}
    </div>` : ""}
    ${invoice.termsAndConditions ? `<div class="terms"><h4>Terms and Conditions</h4><p>${invoice.termsAndConditions.replace(/\n/g, "<br/>")}</p></div>` : ""}
    ${invoice.additionalNotes ? `<div class="terms"><h4>Additional Notes</h4><p>${invoice.additionalNotes.replace(/\n/g, "<br/>")}</p></div>` : ""}
  </div>
  <div class="totals">
    <div class="total-row"><span>Sub Total</span><span>₹${fmt(invoice.subTotal)}</span></div>
    ${invoice.discountPercent ? `<div class="total-row discount"><span>Discount (${invoice.discountPercent}%)</span><span>- ₹${fmt(invoice.discountAmount)}</span></div>` : ""}
    <div class="total-row"><span>Taxable Amount</span><span>₹${fmt(invoice.taxableAmount)}</span></div>
    ${invoice.totalCGST ? `<div class="total-row"><span>CGST</span><span>₹${fmt(invoice.totalCGST)}</span></div>` : ""}
    ${invoice.totalSGST ? `<div class="total-row"><span>SGST</span><span>₹${fmt(invoice.totalSGST)}</span></div>` : ""}
    ${invoice.totalIGST ? `<div class="total-row"><span>IGST</span><span>₹${fmt(invoice.totalIGST)}</span></div>` : ""}
    <div class="total-row grand"><span>Total</span><span>₹${fmt(invoice.grandTotal)}</span></div>
    <div class="words">${invoice.totalInWords}</div>
    ${invoice.earlyPayDiscount ? `
    <div class="total-row early"><span>EarlyPay Discount${invoice.earlyPayDate ? " (before " + fmtDate(invoice.earlyPayDate) + ")" : ""}</span><span>₹${fmt(invoice.earlyPayDiscount)}</span></div>
    <div class="total-row"><span><strong>EarlyPay Amount</strong></span><span><strong>₹${fmt(invoice.earlyPayAmount)}</strong></span></div>
    ` : ""}
  </div>
</div>

<div class="footer">
  ${invoice.billedBy?.email ? `For enquiries: <strong>${invoice.billedBy.email}</strong>` : ""}
  ${invoice.billedBy?.phone ? ` &nbsp;|&nbsp; <strong>${invoice.billedBy.phone}</strong>` : ""}
</div>
</body>
</html>`;
};

// GET Invoice HTML (for preview / PDF download)
const getInvoiceHTML = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    const html = generateInvoiceHTML(invoice);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET Invoice PDF (download)
const getInvoicePDF = async (req, res) => {
  let browser;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
    });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const html = generateInvoiceHTML(invoice);

    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_BIN ||
      undefined;

    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new",
      executablePath,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });

    const safeNumber = String(invoice.invoiceNumber || "invoice").replace(/[^a-zA-Z0-9-_]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${safeNumber}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  updateStatus,
  getInvoiceHTML,
  getInvoicePDF,
};
