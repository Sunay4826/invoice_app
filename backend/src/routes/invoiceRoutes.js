const express = require("express");
const router = express.Router();
const {
  createInvoice,
  getAllInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  updateStatus,
  getInvoiceHTML,
} = require("../controllers/invoiceController");
const auth = require("../middleware/auth");

// CRUD
router.post("/", auth, createInvoice);
router.get("/", auth, getAllInvoices);
router.get("/:id", auth, getInvoice);
router.put("/:id", auth, updateInvoice);
router.delete("/:id", auth, deleteInvoice);

// Special
router.patch("/:id/status", auth, updateStatus);
router.get("/:id/html", auth, getInvoiceHTML);

module.exports = router;
