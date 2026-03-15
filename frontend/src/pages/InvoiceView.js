import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoiceApi } from "../utils/api";
import { formatCurrency, formatCurrencyCompact, formatDate, getErrorMessage } from "../utils/helpers";
import { ToastContext } from "../App";

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useContext(ToastContext);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    invoiceApi.getById(id)
      .then((res) => { setInvoice(res.data.data); setLoading(false); })
      .catch((err) => { showToast(getErrorMessage(err, "We couldn't load this invoice. Please try again."), "error"); setLoading(false); });
  }, [id]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const htmlUrl = invoiceApi.getHTMLUrl(id);
      const win = window.open(htmlUrl, "_blank");
      if (!win) {
        showToast("Please allow pop‑ups so we can open the PDF preview.", "error");
        return;
      }
      win.onload = () => {
        setTimeout(() => {
          win.print();
        }, 500);
      };
      showToast("PDF preview opened. Use Print → Save as PDF.");
    } catch (err) {
      showToast(getErrorMessage(err, "Download failed"), "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) return;
    try {
      await invoiceApi.delete(id);
      showToast("Invoice deleted successfully.");
      navigate("/");
    } catch (err) {
      showToast(getErrorMessage(err, "We couldn't delete the invoice. Please try again."), "error");
    }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 80 }}>
      <div className="spinner dark" style={{ width: 32, height: 32, margin: "0 auto" }} />
      <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>Loading invoice...</div>
    </div>
  );

  if (!invoice) return (
      <div className="empty-state">
        <div className="empty-hero">
          <div className="empty-badge">Invoice</div>
          <h3>We couldn’t find this invoice</h3>
          <p>It may have been deleted or you may not have access.</p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => navigate("/")}>Back to Invoices</button>
          </div>
        </div>
      </div>
  );

  const fmt = formatCurrency;
  const fmtCompact = formatCurrencyCompact;

  return (
    <div>
      {/* ── Actions Bar ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>← Back to Invoices</button>
          <h1 className="page-title">Invoice <span>{invoice.invoiceNumber}</span></h1>
          <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleDownloadPDF} disabled={downloading}>
            {downloading ? <span className="spinner dark" /> : "📥"} Download Invoice PDF
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/invoice/${id}/edit`)}>
            ✏️ Edit Invoice
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️ Delete Invoice</button>
        </div>
      </div>

      {/* ── Invoice Preview Card ── */}
      <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="card-body" style={{ padding: 40 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--text-main)", letterSpacing: -0.4, marginBottom: 8 }}>
                Invoice
              </h2>
              <div style={{ lineHeight: 2, fontSize: 14 }}>
                <div><span style={{ color: "var(--text-muted)", display: "inline-block", width: 130 }}>Invoice Number</span><strong>{invoice.invoiceNumber}</strong></div>
                <div><span style={{ color: "var(--text-muted)", display: "inline-block", width: 130 }}>Invoice Date</span><strong>{formatDate(invoice.invoiceDate)}</strong></div>
                <div><span style={{ color: "var(--text-muted)", display: "inline-block", width: 130 }}>Payment Due</span><strong>{formatDate(invoice.dueDate)}</strong></div>
              </div>
            </div>
            <div style={{
              background: "var(--primary-dark)", color: "#fff",
              padding: "14px 20px", borderRadius: 10,
              fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: 0.6,
            }}>
              {invoice.billedBy?.name || "Company Name"}
            </div>
          </div>

          {/* Parties */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <PartyBox label="Issued By" party={invoice.billedBy} />
            <PartyBox label="Customer" party={invoice.billedTo} />
          </div>

          {/* Supply Row */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            background: "var(--primary-pale)", borderRadius: 8, padding: "10px 16px",
            marginBottom: 20, fontSize: 13,
          }}>
            <div>Place of Supply &nbsp;<strong>{invoice.placeOfSupply || "—"}</strong></div>
            <div>Country &nbsp;<strong>{invoice.countryOfSupply}</strong></div>
          </div>

          {/* Line Items */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
            <thead>
              <tr style={{ background: "var(--primary-light)" }}>
                {["Item Description", "Quantity", "Unit Price", "Tax Rate", "Line Total"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: 12, fontWeight: 600, letterSpacing: .4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invoice.lineItems || []).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "16px 12px", color: "var(--text-muted)" }}>
                    No items have been added yet. Add a product or service to this invoice.
                  </td>
                </tr>
              ) : (invoice.lineItems || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600 }}>{item.description || `Item ${i + 1}`}</div>
                    {item.hsn && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>HSN/SKU: {item.hsn}</div>}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{item.qty}</td>
                  <td style={{ padding: "10px 12px" }} className="amount-full" title={fmt(item.rate)}>{fmtCompact(item.rate)}</td>
                  <td style={{ padding: "10px 12px" }}>{item.gstPercent}%</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }} className="amount-full" title={fmt(item.amount)}>{fmtCompact(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom: Bank + Totals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32 }}>
            <div>
              {invoice.bankDetails?.accountNumber && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginBottom: 10 }}>
                    Payment Details
                  </h4>
                  {[
                    ["Account Holder", invoice.bankDetails.accountHolderName],
                    ["Account Number", invoice.bankDetails.accountNumber],
                    ["IFSC", invoice.bankDetails.ifsc],
                    ["Account Type", invoice.bankDetails.accountType],
                    ["Bank", invoice.bankDetails.bankName],
                    invoice.bankDetails.upi && ["UPI ID", invoice.bankDetails.upi],
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} style={{ display: "flex", gap: 12, marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)", width: 140, flexShrink: 0 }}>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              )}
              {invoice.termsAndConditions && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginBottom: 8 }}>Payment Terms</h4>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, whiteSpace: "pre-line" }}>{invoice.termsAndConditions}</p>
                </div>
              )}
              {invoice.additionalNotes && (
                <div>
                  <h4 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginBottom: 8 }}>Notes</h4>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, whiteSpace: "pre-line" }}>{invoice.additionalNotes}</p>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="totals-box" style={{ height: "fit-content" }}>
              <div className="summary-title">Payment Summary</div>
              <div className="total-row"><span>Subtotal</span><span className="amount-full" title={fmt(invoice.subTotal)}>{fmtCompact(invoice.subTotal)}</span></div>
              {invoice.discountPercent > 0 && (
                <div className="total-row discount">
                  <span>Discount ({invoice.discountPercent}%)</span>
                  <span className="amount-full" title={fmt(invoice.discountAmount)}>- {fmtCompact(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="total-row"><span>Taxable Amount</span><span className="amount-full" title={fmt(invoice.taxableAmount)}>{fmtCompact(invoice.taxableAmount)}</span></div>
              {invoice.totalCGST > 0 && <div className="total-row"><span>Central GST (CGST)</span><span className="amount-full" title={fmt(invoice.totalCGST)}>{fmtCompact(invoice.totalCGST)}</span></div>}
              {invoice.totalSGST > 0 && <div className="total-row"><span>State GST (SGST)</span><span className="amount-full" title={fmt(invoice.totalSGST)}>{fmtCompact(invoice.totalSGST)}</span></div>}
              {invoice.totalIGST > 0 && <div className="total-row"><span>Integrated GST (IGST)</span><span className="amount-full" title={fmt(invoice.totalIGST)}>{fmtCompact(invoice.totalIGST)}</span></div>}
              <div className="total-row grand"><span>Total Amount</span><span className="amount-full" title={fmt(invoice.grandTotal)}>{fmtCompact(invoice.grandTotal)}</span></div>
              {invoice.totalInWords && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, marginBottom: 10, lineHeight: 1.5 }}>
                  {invoice.totalInWords}
                </p>
              )}
              {invoice.earlyPayDiscount > 0 && (
                <>
                  <div className="total-row early">
                    <span>Early Payment Discount{invoice.earlyPayDate ? ` (before ${formatDate(invoice.earlyPayDate)})` : ""}</span>
                    <span className="amount-full" title={fmt(invoice.earlyPayDiscount)}>{fmtCompact(invoice.earlyPayDiscount)}</span>
                  </div>
                  <div className="total-row"><span><strong>Early Payment Total</strong></span><span className="amount-full" title={fmt(invoice.earlyPayAmount)}><strong>{fmtCompact(invoice.earlyPayAmount)}</strong></span></div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          {(invoice.billedBy?.email || invoice.billedBy?.phone) && (
            <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
              Questions? Contact{" "}
              {invoice.billedBy.email && <strong>{invoice.billedBy.email}</strong>}
              {invoice.billedBy.email && invoice.billedBy.phone && " | "}
              {invoice.billedBy.phone && <strong>{invoice.billedBy.phone}</strong>}
            </div>
          )}

        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}

function PartyBox({ label, party }) {
  if (!party) return null;
  return (
    <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", boxShadow: "var(--shadow-sm)" }}>
      <h4 style={{ color: "var(--text-main)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{label}</h4>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-main)" }}>
        <strong>{party.name}</strong><br />
        {party.address && <>{party.address}<br /></>}
        {[party.city, party.state].filter(Boolean).join(", ")}
        {party.pincode && ` - ${party.pincode}`}
        {(party.city || party.state || party.pincode) && <br />}
        {party.gstin && <>GSTIN: {party.gstin}<br /></>}
        {party.pan && <>PAN: {party.pan}</>}
      </p>
    </div>
  );
}
