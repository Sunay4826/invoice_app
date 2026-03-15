import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5001/api",
  headers: { "Content-Type": "application/json" },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  signup: (data) => API.post("/auth/signup", data),
  login: (data) => API.post("/auth/login", data),
  me: () => API.get("/auth/me"),
};

export const invoiceApi = {
  create: (data) => API.post("/invoices", data),
  getAll: (params) => API.get("/invoices", { params }),
  getById: (id) => API.get(`/invoices/${id}`),
  update: (id, data) => API.put(`/invoices/${id}`, data),
  delete: (id) => API.delete(`/invoices/${id}`),
  updateStatus: (id, status) => API.patch(`/invoices/${id}/status`, { status }),
  getHTMLUrl: (id) => `${API.defaults.baseURL}/invoices/${id}/html`,
};

export default API;
