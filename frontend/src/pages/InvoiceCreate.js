import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoiceApi } from "../utils/api";
import {
  indianStates, gstRates, emptyLineItem,
  computeLineItem, computeTotals, formatCurrency, formatCurrencyCompact, toInputDate, getErrorMessage,
} from "../utils/helpers";
import { ToastContext } from "../App";

const defaultForm = {
  invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
  invoiceDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  billedBy: { name: "", address: "", city: "", state: "", pincode: "", gstin: "", pan: "", email: "", phone: "" },
  billedTo: { name: "", address: "", city: "", state: "", pincode: "", gstin: "", pan: "", email: "", phone: "" },
  placeOfSupply: "",
  countryOfSupply: "India",
  lineItems: [emptyLineItem()],
  discountPercent: 0,
  earlyPayDiscount: 0,
  earlyPayDate: "",
  bankDetails: { accountHolderName: "", accountNumber: "", ifsc: "", accountType: "", bankName: "", upi: "" },
  termsAndConditions: "1. Please pay within 15 days from the date of invoice. Overdue interest @ 14% will be charged on delayed payments.\n2. Please quote invoice number when remitting funds.",
  additionalNotes: "",
  status: "draft",
};

function SectionHeader({ icon, title }) {
  return (
    <div className="form-section-header">
      <span>{icon}</span>
      <span className="form-section-title">{title}</span>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span className="required">*</span>}
      </label>
      {children}
    </div>
  );
}

function PreviewParty({ label, party }) {
  return (
    <div className="preview-party">
      <div className="preview-party-label">{label}</div>
      <div className="preview-party-name">{party?.name || "—"}</div>
      <div className="preview-party-meta">
        {[party?.address, party?.city, party?.state, party?.pincode].filter(Boolean).join(", ") || "—"}
      </div>
      <div className="preview-party-meta">
        {party?.gstin ? `GSTIN: ${party.gstin}` : " "}
      </div>
    </div>
  );
}

function InvoicePreview({ form, totals }) {
  return (
    <div className="preview-card">
      <div className="preview-header">
        <div>
          <div className="preview-title">Invoice</div>
          <div className="preview-meta">
            <div>Invoice# <strong>{form.invoiceNumber || "—"}</strong></div>
            <div>Invoice Date <strong>{form.invoiceDate || "—"}</strong></div>
            <div>Due Date <strong>{form.dueDate || "—"}</strong></div>
          </div>
        </div>
        <div className="preview-logo">{form.billedBy?.name || "COMPANY"}</div>
      </div>

      <div className="preview-parties">
        <PreviewParty label="Billed by" party={form.billedBy} />
        <PreviewParty label="Billed to" party={form.billedTo} />
      </div>

      <div className="preview-supply">
        <div>Place of Supply <strong>{form.placeOfSupply || "—"}</strong></div>
        <div>Country of Supply <strong>{form.countryOfSupply || "India"}</strong></div>
      </div>

      <div className="preview-table">
        <div className="preview-table-head">
          <span>Item</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Amount</span>
        </div>
        {(form.lineItems || []).map((item, i) => (
          <div className="preview-table-row" key={i}>
            <span>{item.description || `Item ${i + 1}`}</span>
            <span>{item.qty}</span>
            <span className="amount" title={formatCurrency(item.rate)}>{formatCurrencyCompact(item.rate)}</span>
            <span className="amount" title={formatCurrency(item.amount)}>{formatCurrencyCompact(item.amount)}</span>
          </div>
        ))}
      </div>

      <div className="preview-totals">
        <div className="preview-total-row"><span>Sub Total</span><span className="amount" title={formatCurrency(totals.subTotal)}>{formatCurrencyCompact(totals.subTotal)}</span></div>
        {form.discountPercent > 0 && (
          <div className="preview-total-row discount"><span>Discount ({form.discountPercent}%)</span><span className="amount" title={formatCurrency(totals.discountAmount)}>- {formatCurrencyCompact(totals.discountAmount)}</span></div>
        )}
        <div className="preview-total-row"><span>Taxable Amount</span><span className="amount" title={formatCurrency(totals.taxableAmount)}>{formatCurrencyCompact(totals.taxableAmount)}</span></div>
        <div className="preview-total-row"><span>CGST</span><span className="amount" title={formatCurrency(totals.totalCGST)}>{formatCurrencyCompact(totals.totalCGST)}</span></div>
        <div className="preview-total-row"><span>SGST</span><span className="amount" title={formatCurrency(totals.totalSGST)}>{formatCurrencyCompact(totals.totalSGST)}</span></div>
        <div className="preview-total-row grand"><span>Total</span><span className="amount" title={formatCurrency(totals.grandTotal)}>{formatCurrencyCompact(totals.grandTotal)}</span></div>
      </div>
    </div>
  );
}

export default function InvoiceCreate() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const showToast = useContext(ToastContext);

  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  // Load invoice for edit
  useEffect(() => {
    if (!isEdit) return;
    invoiceApi.getById(id).then((res) => {
      const d = res.data.data;
      setForm({
        ...d,
        invoiceDate: toInputDate(d.invoiceDate),
        dueDate: toInputDate(d.dueDate),
        earlyPayDate: toInputDate(d.earlyPayDate),
      });
      setLoading(false);
    }).catch((err) => { showToast(getErrorMessage(err, "Failed to load invoice"), "error"); setLoading(false); });
  }, [id]);

  // ── Field helpers ──
  const set = (path, value) => {
    setForm((prev) => {
      const next = { ...prev };
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const setLineItem = (i, field, value) => {
    setForm((prev) => {
      const items = [...prev.lineItems];
      const updated = computeLineItem({ ...items[i], [field]: value });
      items[i] = updated;
      return { ...prev, lineItems: items };
    });
  };

  const addLineItem = () => setForm((p) => ({ ...p, lineItems: [...p.lineItems, emptyLineItem()] }));

  const removeLineItem = (i) =>
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((_, idx) => idx !== i) }));

  const totals = computeTotals(form.lineItems, form.discountPercent, form.earlyPayDiscount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let res;
      if (isEdit) {
        res = await invoiceApi.update(id, form);
      } else {
        res = await invoiceApi.create(form);
      }
      showToast(isEdit ? "Invoice updated!" : "Invoice created!");
      navigate(`/invoice/${res.data.data.id}`);
    } catch (err) {
      showToast(getErrorMessage(err, "Save failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 80 }}>
      <div className="spinner dark" style={{ width: 32, height: 32, margin: "0 auto" }} />
      <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>Loading invoice...</div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="page-header">
        <h1 className="page-title">{isEdit ? "Edit" : "New"} <span>Invoice</span></h1>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : isEdit ? "💾 Save Changes" : "✨ Create Invoice"}
          </button>
        </div>
      </div>

      <div className="create-layout">
        <div className="create-form">
          {/* ── Invoice Meta ── */}
          <div className="form-section">
            <SectionHeader icon="📄" title="Invoice Details" />
            <div className="form-section-body">
              <div className="form-grid form-grid-3">
            <Field label="Invoice Number" required>
              <input className="form-input" value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} required />
            </Field>
            <Field label="Invoice Date" required>
              <input type="date" className="form-input" value={form.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} required />
            </Field>
            <Field label="Due Date" required>
              <input type="date" className="form-input" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} required />
            </Field>
            <Field label="Status">
              <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {["draft","sent","paid","overdue","cancelled"].map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Place of Supply">
              <select className="form-select" value={form.placeOfSupply} onChange={(e) => set("placeOfSupply", e.target.value)}>
                <option value="">Select state</option>
                {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Country of Supply">
              <input className="form-input" value={form.countryOfSupply} onChange={(e) => set("countryOfSupply", e.target.value)} />
            </Field>
              </div>
            </div>
          </div>

      {/* ── Parties ── */}
      <div className="form-grid form-grid-2" style={{ marginBottom: 20 }}>
        {/* Billed By */}
        <div className="form-section" style={{ marginBottom: 0 }}>
          <SectionHeader icon="🏢" title="Billed By (Your Company)" />
          <div className="form-section-body">
            <div className="form-grid">
              <Field label="Company Name" required>
                <input className="form-input" value={form.billedBy.name} onChange={(e) => set("billedBy.name", e.target.value)} required />
              </Field>
              <Field label="Address">
                <input className="form-input" value={form.billedBy.address} onChange={(e) => set("billedBy.address", e.target.value)} />
              </Field>
              <div className="form-grid form-grid-2">
                <Field label="City"><input className="form-input" value={form.billedBy.city} onChange={(e) => set("billedBy.city", e.target.value)} /></Field>
                <Field label="State">
                  <select className="form-select" value={form.billedBy.state} onChange={(e) => set("billedBy.state", e.target.value)}>
                    <option value="">State</option>
                    {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="form-grid form-grid-2">
                <Field label="Pincode"><input className="form-input" value={form.billedBy.pincode} onChange={(e) => set("billedBy.pincode", e.target.value)} /></Field>
                <Field label="PAN"><input className="form-input" value={form.billedBy.pan} onChange={(e) => set("billedBy.pan", e.target.value)} /></Field>
              </div>
              <Field label="GSTIN"><input className="form-input" value={form.billedBy.gstin} onChange={(e) => set("billedBy.gstin", e.target.value)} /></Field>
              <div className="form-grid form-grid-2">
                <Field label="Email"><input type="email" className="form-input" value={form.billedBy.email} onChange={(e) => set("billedBy.email", e.target.value)} /></Field>
                <Field label="Phone"><input className="form-input" value={form.billedBy.phone} onChange={(e) => set("billedBy.phone", e.target.value)} /></Field>
              </div>
            </div>
          </div>
        </div>

        {/* Billed To */}
        <div className="form-section" style={{ marginBottom: 0 }}>
          <SectionHeader icon="👤" title="Billed To (Client)" />
          <div className="form-section-body">
            <div className="form-grid">
              <Field label="Client Name" required>
                <input className="form-input" value={form.billedTo.name} onChange={(e) => set("billedTo.name", e.target.value)} required />
              </Field>
              <Field label="Address">
                <input className="form-input" value={form.billedTo.address} onChange={(e) => set("billedTo.address", e.target.value)} />
              </Field>
              <div className="form-grid form-grid-2">
                <Field label="City"><input className="form-input" value={form.billedTo.city} onChange={(e) => set("billedTo.city", e.target.value)} /></Field>
                <Field label="State">
                  <select className="form-select" value={form.billedTo.state} onChange={(e) => set("billedTo.state", e.target.value)}>
                    <option value="">State</option>
                    {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="form-grid form-grid-2">
                <Field label="Pincode"><input className="form-input" value={form.billedTo.pincode} onChange={(e) => set("billedTo.pincode", e.target.value)} /></Field>
                <Field label="PAN"><input className="form-input" value={form.billedTo.pan} onChange={(e) => set("billedTo.pan", e.target.value)} /></Field>
              </div>
              <Field label="GSTIN"><input className="form-input" value={form.billedTo.gstin} onChange={(e) => set("billedTo.gstin", e.target.value)} /></Field>
              <div className="form-grid form-grid-2">
                <Field label="Email"><input type="email" className="form-input" value={form.billedTo.email} onChange={(e) => set("billedTo.email", e.target.value)} /></Field>
                <Field label="Phone"><input className="form-input" value={form.billedTo.phone} onChange={(e) => set("billedTo.phone", e.target.value)} /></Field>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Line Items ── */}
      <div className="form-section">
        <SectionHeader icon="📦" title="Line Items" />
        <div className="form-section-body">
          <div style={{ overflowX: "auto" }}>
            <table className="line-items-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Description *</th>
                  <th style={{ width: 80 }}>HSN</th>
                  <th style={{ width: 80 }}>Qty *</th>
                  <th style={{ width: 110 }}>Rate (₹) *</th>
                  <th style={{ width: 90 }}>GST %</th>
                  <th style={{ width: 120 }}>Taxable Amt</th>
                  <th style={{ width: 100 }}>SGST</th>
                  <th style={{ width: 100 }}>CGST</th>
                  <th style={{ width: 120 }}>Amount</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lineItems.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className="form-input"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => setLineItem(i, "description", e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input className="form-input" value={item.hsn} onChange={(e) => setLineItem(i, "hsn", e.target.value)} placeholder="HSN" />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.01"
                        className="form-input"
                        value={item.qty}
                        onChange={(e) => setLineItem(i, "qty", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.01"
                        className="form-input"
                        value={item.rate}
                        onChange={(e) => setLineItem(i, "rate", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={item.gstPercent}
                        onChange={(e) => setLineItem(i, "gstPercent", parseFloat(e.target.value))}
                      >
                        {gstRates.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 500 }} title={formatCurrency(item.taxableAmount)}>{formatCurrencyCompact(item.taxableAmount)}</td>
                    <td style={{ textAlign: "right", color: "var(--text-muted)" }} title={formatCurrency(item.sgst)}>{formatCurrencyCompact(item.sgst)}</td>
                    <td style={{ textAlign: "right", color: "var(--text-muted)" }} title={formatCurrency(item.cgst)}>{formatCurrencyCompact(item.cgst)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--primary-light)" }} title={formatCurrency(item.amount)}>{formatCurrencyCompact(item.amount)}</td>
                    <td>
                      {form.lineItems.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeLineItem(i)} title="Remove">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={addLineItem}>
            + Add Item
          </button>
        </div>
      </div>

      {/* ── Discount + Totals ── */}
      <div className="adjustments-grid" style={{ marginBottom: 20 }}>
        <div className="form-section" style={{ marginBottom: 0 }}>
          <SectionHeader icon="💰" title="Adjustments" />
          <div className="form-section-body">
            <div className="form-grid form-grid-2">
              <Field label="Discount (%)">
                <input
                  type="number" min="0" max="100" step="0.01"
                  className="form-input"
                  value={form.discountPercent}
                  onChange={(e) => set("discountPercent", parseFloat(e.target.value) || 0)}
                />
              </Field>
              <Field label="EarlyPay Discount (₹)">
                <input
                  type="number" min="0" step="0.01"
                  className="form-input"
                  value={form.earlyPayDiscount}
                  onChange={(e) => set("earlyPayDiscount", parseFloat(e.target.value) || 0)}
                />
              </Field>
              <Field label="EarlyPay Deadline">
                <input type="date" className="form-input" value={form.earlyPayDate} onChange={(e) => set("earlyPayDate", e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="totals-box">
          <div className="total-row"><span>Sub Total</span><span className="amount" title={formatCurrency(totals.subTotal)}>{formatCurrencyCompact(totals.subTotal)}</span></div>
          {form.discountPercent > 0 && (
            <div className="total-row discount"><span>Discount ({form.discountPercent}%)</span><span className="amount" title={formatCurrency(totals.discountAmount)}>- {formatCurrencyCompact(totals.discountAmount)}</span></div>
          )}
          <div className="total-row"><span>Taxable Amount</span><span className="amount" title={formatCurrency(totals.taxableAmount)}>{formatCurrencyCompact(totals.taxableAmount)}</span></div>
          <div className="total-row"><span>CGST</span><span className="amount" title={formatCurrency(totals.totalCGST)}>{formatCurrencyCompact(totals.totalCGST)}</span></div>
          <div className="total-row"><span>SGST</span><span className="amount" title={formatCurrency(totals.totalSGST)}>{formatCurrencyCompact(totals.totalSGST)}</span></div>
          <div className="total-row grand"><span>Total</span><span className="amount" title={formatCurrency(totals.grandTotal)}>{formatCurrencyCompact(totals.grandTotal)}</span></div>
          {form.earlyPayDiscount > 0 && (
            <>
              <div className="total-row early"><span>EarlyPay Discount</span><span className="amount" title={formatCurrency(form.earlyPayDiscount)}>- {formatCurrencyCompact(form.earlyPayDiscount)}</span></div>
              <div className="total-row"><span><strong>EarlyPay Amount</strong></span><span className="amount" title={formatCurrency(totals.earlyPayAmount)}><strong>{formatCurrencyCompact(totals.earlyPayAmount)}</strong></span></div>
            </>
          )}
        </div>
      </div>

      {/* ── Bank Details ── */}
      <div className="form-section">
        <SectionHeader icon="🏦" title="Bank & Payment Details" />
        <div className="form-section-body">
          <div className="form-grid form-grid-3">
            <Field label="Account Holder Name">
              <input className="form-input" value={form.bankDetails.accountHolderName} onChange={(e) => set("bankDetails.accountHolderName", e.target.value)} />
            </Field>
            <Field label="Account Number">
              <input className="form-input" value={form.bankDetails.accountNumber} onChange={(e) => set("bankDetails.accountNumber", e.target.value)} />
            </Field>
            <Field label="IFSC Code">
              <input className="form-input" value={form.bankDetails.ifsc} onChange={(e) => set("bankDetails.ifsc", e.target.value)} />
            </Field>
            <Field label="Account Type">
              <select className="form-select" value={form.bankDetails.accountType} onChange={(e) => set("bankDetails.accountType", e.target.value)}>
                <option value="">Select type</option>
                <option value="Savings">Savings</option>
                <option value="Current">Current</option>
              </select>
            </Field>
            <Field label="Bank Name">
              <input className="form-input" value={form.bankDetails.bankName} onChange={(e) => set("bankDetails.bankName", e.target.value)} />
            </Field>
            <Field label="UPI ID">
              <input className="form-input" value={form.bankDetails.upi} onChange={(e) => set("bankDetails.upi", e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="form-section">
        <SectionHeader icon="📝" title="Terms & Notes" />
        <div className="form-section-body">
          <div className="form-grid form-grid-2">
            <Field label="Terms and Conditions">
              <textarea
                className="form-textarea"
                style={{ minHeight: 100 }}
                value={form.termsAndConditions}
                onChange={(e) => set("termsAndConditions", e.target.value)}
              />
            </Field>
            <Field label="Additional Notes">
              <textarea
                className="form-textarea"
                style={{ minHeight: 100 }}
                value={form.additionalNotes}
                onChange={(e) => set("additionalNotes", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

          {/* ── Submit ── */}
          <div className="flex flex-end gap-2" style={{ paddingBottom: 40 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : isEdit ? "💾 Save Changes" : "✨ Create Invoice"}
            </button>
          </div>
        </div>

        <aside className="create-preview">
          <div className="preview-title-row">Live Preview</div>
          <InvoicePreview form={form} totals={totals} />
        </aside>
      </div>

      <div className="action-bar">
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="spinner" /> : isEdit ? "💾 Save Changes" : "✨ Create Invoice"}
        </button>
      </div>
    </form>
  );
}
