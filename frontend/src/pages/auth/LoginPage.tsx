import { useEffect, useState } from "react";
import api from "../../api/client";
import type { CSSProperties } from "react";

type MeResponse = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "teacher" | "student" | "admin";
  is_active: boolean;
  created_at: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const tryRestoreSession = async () => {
      try {
        const res = await api.get<MeResponse>("/auth/me");
        redirectByRole(res.data.role);
      } catch {
        localStorage.removeItem("token");
      }
    };

    tryRestoreSession();
  }, []);

  const redirectByRole = (role: MeResponse["role"]) => {
    if (role === "teacher") { window.location.href = "/teacher"; return; }
    if (role === "student") { window.location.href = "/student"; return; }
    if (role === "admin") { window.location.href = "/admin"; return; }
    window.location.href = "/";
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Введите email и пароль");
      return;
    }
    try {
      setError("");
      setLoading(true);
      const loginRes = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", loginRes.data.access_token);
      const meRes = await api.get<MeResponse>("/auth/me");
      redirectByRole(meRes.data.role);
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div style={wrapStyle}>
      {/* Decorative blobs */}
      <div style={blob1Style} />
      <div style={blob2Style} />
      <div style={blob3Style} />

      <div style={cardStyle}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={logoBoxStyle}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L2 8l10 5 10-5-10-5z" fill="white" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.75" />
              <path d="M2 16l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
            </svg>
          </div>
          <h1 style={brandTitleStyle}>Система оценки вовлечённости</h1>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              placeholder="example@university.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Пароль</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={errorBoxStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1" fill="#dc2626" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={submitBtnStyle}
          >
            {loading ? "Вход..." : "Войти в систему"}
          </button>
        </div>

      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(140deg, #0a1628 0%, #0d2060 50%, #1a0f50 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  position: "relative",
  overflow: "hidden",
};

const blob1Style: CSSProperties = {
  position: "absolute",
  width: 700,
  height: 700,
  borderRadius: "50%",
  background: "rgba(59,130,246,0.07)",
  top: -250,
  right: -150,
  pointerEvents: "none",
};

const blob2Style: CSSProperties = {
  position: "absolute",
  width: 500,
  height: 500,
  borderRadius: "50%",
  background: "rgba(124,58,237,0.07)",
  bottom: -180,
  left: -100,
  pointerEvents: "none",
};

const blob3Style: CSSProperties = {
  position: "absolute",
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "rgba(16,185,129,0.05)",
  bottom: 100,
  right: 100,
  pointerEvents: "none",
};

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  borderRadius: 24,
  padding: "44px 40px 36px",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
  position: "relative",
  zIndex: 1,
};

const logoBoxStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 20,
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 18,
  boxShadow: "0 10px 28px rgba(37,99,235,0.4)",
};

const brandTitleStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: "#0f172a",
  letterSpacing: "-0.5px",
  marginBottom: 6,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 7,
};

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px 14px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 15,
  color: "#0f172a",
  background: "#f8fafc",
  transition: "border-color 0.2s",
};

const errorBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "11px 14px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#dc2626",
  fontSize: 14,
  fontWeight: 500,
};

const submitBtnStyle: CSSProperties = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  color: "white",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
  boxShadow: "0 4px 16px rgba(37,99,235,0.38)",
  letterSpacing: "0.2px",
};

