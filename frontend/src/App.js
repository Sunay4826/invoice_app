import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import InvoiceList from "./pages/InvoiceList";
import InvoiceCreate from "./pages/InvoiceCreate";
import InvoiceView from "./pages/InvoiceView";
import Login from "./pages/AuthLogin";
import Signup from "./pages/AuthSignup";
import { authApi } from "./utils/api";

export const ToastContext = React.createContext(null);
export const AuthContext = React.createContext(null);

function Sidebar() {
  const { user, logout } = React.useContext(AuthContext);
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Invoice<span>Flow</span></h1>
        <p>Invoice Manager</p>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span className="nav-icon">📋</span> All Invoices
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <span className="nav-icon">✨</span> New Invoice
        </NavLink>
        <div className="nav-divider" />
        <div className="nav-meta">Signed in as</div>
        <div className="nav-user">{user?.username || user?.email}</div>
        <button className="btn btn-ghost nav-logout" onClick={logout}>Logout</button>
      </nav>
    </aside>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type}`}>{toast.message}</div>;
}

function RequireAuth({ children }) {
  const { token, loading } = React.useContext(AuthContext);
  const location = useLocation();
  if (loading) return null;
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const [toast, setToast] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("auth_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!token) return;
    authApi.me()
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem("auth_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = (nextToken, nextUser) => {
    localStorage.setItem("auth_token", nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  return (
    <ToastContext.Provider value={showToast}>
      <AuthContext.Provider value={{ token, user, login, logout, loading }}>
        <Router>
          <div className="app-layout">
            {token && <Sidebar />}
            <main className={`main-content ${token ? "" : "full"}`}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/" element={<RequireAuth><InvoiceList /></RequireAuth>} />
                <Route path="/create" element={<RequireAuth><InvoiceCreate /></RequireAuth>} />
                <Route path="/invoice/:id" element={<RequireAuth><InvoiceView /></RequireAuth>} />
                <Route path="/invoice/:id/edit" element={<RequireAuth><InvoiceCreate /></RequireAuth>} />
                <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
              </Routes>
            </main>
          </div>
          <Toast toast={toast} />
        </Router>
      </AuthContext.Provider>
    </ToastContext.Provider>
  );
}
