import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { invoiceApi } from "../utils/api";
import { formatCurrency, formatCurrencyCompact, formatDate, statusOptions, getErrorMessage } from "../utils/helpers";
import { ToastContext } from "../App";

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [stats, setStats] = useState({ total: 0, paid: 0, overdue: 0, draft: 0 });
  const navigate = useNavigate();
  const showToast = useContext(ToastContext);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await invoiceApi.getAll(statusFilter ? { status: statusFilter } : {});
      const data = res.data.data || [];
      setInvoices(data);
      // Compute stats from unfiltered fetch
      if (!statusFilter) {
        const paid = data.filter((i) => i.status === "paid").reduce((s, i) => s + i.grandTotal, 0);
        const overdue = data.filter((i) => i.status === "overdue").length;
        const draft = data.filter((i) => i.status === "draft").length;
        setStats({ total: data.length, paid, overdue, draft });
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load invoices"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [statusFilter]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) return;
    try {
      await invoiceApi.delete(id);
      showToast("Invoice deleted successfully.");
      fetchInvoices();
    } catch (err) {
      showToast(getErrorMessage(err, "Delete failed"), "error");
    }
  };

  const handleStatusChange = async (id, status, e) => {
    e.stopPropagation();
    try {
      await invoiceApi.updateStatus(id, status);
      showToast(`Status updated to ${status}.`);
      fetchInvoices();
    } catch (err) {
      showToast(getErrorMessage(err, "Update failed"), "error");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Invoices <span>Overview</span></h1>
        <button className="btn btn-primary" onClick={() => navigate("/create")}>
          ✨ Create Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Invoices</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Collected Revenue</div>
          <div className="stat-value">{formatCurrencyCompact(stats.paid)}</div>
          <div className="stat-sub">Payments received</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Overdue Invoices</div>
          <div className="stat-value">{stats.overdue}</div>
          <div className="stat-sub">Requires follow‑up</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Drafts</div>
          <div className="stat-value">{stats.draft}</div>
          <div className="stat-sub">Not sent yet</div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Invoice List</span>
          <select
            className="form-select"
            style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div className="spinner dark" style={{ width: 28, height: 28, margin: "0 auto" }} />
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>Loading invoices...</div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-hero">
              <div className="empty-badge">Getting Started</div>
              <h3>Ready to create your first invoice</h3>
              <p>Add customer details, line items, and download a professional PDF in minutes.</p>
              <div className="empty-actions">
                <button className="btn btn-primary" onClick={() => navigate("/create")}>
                  ✨ Create Your First Invoice
                </button>
                <button className="btn btn-secondary" onClick={() => navigate("/create")}>
                  Start From Scratch
                </button>
              </div>
            </div>
            <div className="empty-steps">
              <div className="empty-step">
                <span className="empty-step-num">1</span>
                <div>
                  <div className="empty-step-title">Add company & customer</div>
                  <div className="empty-step-sub">Fill issued by and customer details.</div>
                </div>
              </div>
              <div className="empty-step">
                <span className="empty-step-num">2</span>
                <div>
                  <div className="empty-step-title">Add line items</div>
                  <div className="empty-step-sub">Enter quantity, unit price, and tax rate.</div>
                </div>
              </div>
              <div className="empty-step">
                <span className="empty-step-num">3</span>
                <div>
                  <div className="empty-step-title">Save & download</div>
                  <div className="empty-step-sub">Generate a PDF in seconds.</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Customer</th>
                  <th>Invoice Date</th>
                  <th>Payment Due</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/invoice/${inv.id}`)}
                  >
                    <td><strong style={{ color: "var(--primary-light)" }}>{inv.invoiceNumber}</strong></td>
                    <td>{inv.billedTo?.name}</td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td><strong title={formatCurrency(inv.grandTotal)}>{formatCurrencyCompact(inv.grandTotal)}</strong></td>
                    <td>
                      <select
                        className={`badge badge-${inv.status}`}
                        value={inv.status}
                        onChange={(e) => handleStatusChange(inv.id, e.target.value, e)}
                        style={{ border: "none", cursor: "pointer", font: "inherit", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" }}
                      >
                        {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title="View"
                          onClick={(e) => { e.stopPropagation(); navigate(`/invoice/${inv.id}`); }}
                        >👁️</button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title="Edit"
                          onClick={(e) => { e.stopPropagation(); navigate(`/invoice/${inv.id}/edit`); }}
                        >✏️</button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title="Delete"
                          onClick={(e) => handleDelete(inv.id, e)}
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
