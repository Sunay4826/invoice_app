export const formatCurrency = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0);

export const formatCurrencyCompact = (n) => {
  const value = Number(n || 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(2)}K`;
  return formatCurrency(value);
};

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export const toInputDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().split("T")[0];
};

export const indianStates = [
  "Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar",
  "Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand",
  "Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra",
  "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal",
];

export const gstRates = [0, 5, 12, 18, 28];

export const statusOptions = ["draft", "sent", "paid", "overdue", "cancelled"];

export const emptyLineItem = () => ({
  description: "",
  hsn: "",
  qty: 1,
  rate: 0,
  gstPercent: 18,
  taxableAmount: 0,
  sgst: 0,
  cgst: 0,
  igst: 0,
  amount: 0,
});

export const computeLineItem = (item) => {
  const taxableAmount = parseFloat(((item.qty || 0) * (item.rate || 0)).toFixed(2));
  const gstRate = (item.gstPercent || 0) / 100;
  const cgst = parseFloat((taxableAmount * gstRate * 0.5).toFixed(2));
  const sgst = parseFloat((taxableAmount * gstRate * 0.5).toFixed(2));
  const igst = parseFloat((taxableAmount * gstRate).toFixed(2));
  const amount = parseFloat((taxableAmount + igst).toFixed(2));
  return { ...item, taxableAmount, cgst, sgst, igst, amount };
};

export const computeTotals = (lineItems, discountPercent, earlyPayDiscount) => {
  const subTotal = lineItems.reduce((s, i) => s + (i.taxableAmount || 0), 0);
  const discountAmount = parseFloat(((subTotal * (discountPercent || 0)) / 100).toFixed(2));
  const taxableAmount = parseFloat((subTotal - discountAmount).toFixed(2));
  const discountFactor = 1 - (discountPercent || 0) / 100;
  const totalCGST = parseFloat(lineItems.reduce((s, i) => s + (i.cgst || 0) * discountFactor, 0).toFixed(2));
  const totalSGST = parseFloat(lineItems.reduce((s, i) => s + (i.sgst || 0) * discountFactor, 0).toFixed(2));
  const grandTotal = parseFloat((taxableAmount + totalCGST + totalSGST).toFixed(2));
  const earlyPayAmount = parseFloat((grandTotal - (earlyPayDiscount || 0)).toFixed(2));
  return { subTotal, discountAmount, taxableAmount, totalCGST, totalSGST, grandTotal, earlyPayAmount };
};

export const getErrorMessage = (err, fallback = "Something went wrong") => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message) return err.message;
  return fallback;
};
