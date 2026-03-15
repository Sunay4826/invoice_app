# InvoiceFlow — Full-Stack Invoice Manager

A complete invoice management system built with React, Node.js, Express, Prisma, and PostgreSQL.

## 📁 Project Structure

```
invoice-app/
├── backend/          # Node.js + Express + Prisma + PostgreSQL API
└── frontend/         # React SPA
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- PostgreSQL (Prisma-compatible; Prisma Accelerate supported)

---

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL and DIRECT_URL
npx prisma db push
npm run dev
```

Backend runs on **http://localhost:5001**

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs on **http://localhost:3000**

---

## 🌐 Live Demo

- **Frontend**: http://invoice-app-1-ra6b.onrender.com/
- **Backend Health**: https://invoice-app-ta1s.onrender.com/api/health

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create user (email, username, password) |
| POST | `/api/auth/login` | Login (email or username + password) |
| GET | `/api/auth/me` | Get current user |

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices` | Create invoice (auth required) |
| GET | `/api/invoices` | List invoices (auth required) |
| GET | `/api/invoices/:id` | Get single invoice (auth required) |
| PUT | `/api/invoices/:id` | Update invoice (auth required) |
| DELETE | `/api/invoices/:id` | Delete invoice (auth required) |
| PATCH | `/api/invoices/:id/status` | Update status only (auth required) |
| GET | `/api/invoices/:id/html` | Get printable HTML (auth required) |
| GET | `/api/health` | Health check |

---

## 📊 Database Schema (PostgreSQL + Prisma)

**Invoice** model includes:
- Invoice metadata (number, dates, status)
- `billedBy` — seller company details
- `billedTo` — client details
- `lineItems[]` — items with HSN, qty, rate, GST, computed amounts
- Computed totals (subTotal, discountAmount, taxableAmount, CGST, SGST, IGST, grandTotal)
- `bankDetails` — payment info
- Terms, notes, earlyPay discount

---

## 🖨️ PDF Download

The `/api/invoices/:id/html` endpoint returns a print-ready HTML page.
On the frontend, clicking **Download PDF** opens this in a new tab — use your browser's **Print → Save as PDF** to download.

---

## ✨ Features

- **Create Invoices** — Full form with live total calculations
- **GST Support** — CGST/SGST (intra-state) and IGST (inter-state) auto-computed
- **Line Items** — Add/remove items with live totals
- **Discounts** — Percentage discount + EarlyPay discount
- **PDF Export** — Print-ready invoice via browser print dialog
- **Status Management** — draft → sent → paid / overdue / cancelled
- **Dashboard Stats** — Total count, paid revenue, overdue count, drafts

---

## 🛠️ Tech Stack

- **Frontend**: React 18, React Router v6, Axios
- **Backend**: Node.js, Express 4, Prisma ORM
- **Database**: PostgreSQL
- **Styling**: Custom CSS with design tokens
