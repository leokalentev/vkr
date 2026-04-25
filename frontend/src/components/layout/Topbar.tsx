import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import api from "../../api/client";

type Props = {
  title: string;
  subtitle?: string;
};

type Me = {
  first_name: string;
  last_name: string;
  role: string;
};

export default function Topbar({ title, subtitle }: Props) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => setMe(r.data))
      .catch(() => {});
  }, []);

  const initials = me
    ? `${me.first_name[0] ?? ""}${me.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  const roleLabel: Record<string, string> = {
    admin: "Администратор",
    teacher: "Преподаватель",
    student: "Студент",
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <header style={topbarStyle}>
      <div style={leftStyle}>
        <div>
          <h1 style={titleStyle}>{title}</h1>
          {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        </div>
      </div>

      <div style={rightStyle}>
        <div style={searchStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>Поиск...</span>
        </div>

        {me && (
          <div style={userBlockStyle}>
            <div style={{ textAlign: "right" }}>
              <div style={userNameStyle}>{me.last_name} {me.first_name}</div>
              <div style={userRoleStyle}>{roleLabel[me.role] ?? me.role}</div>
            </div>
            <div
              style={avatarStyle}
              title="Выйти из системы"
              onClick={handleLogout}
            >
              {initials}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

const topbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 24,
  width: "100%",
};

const leftStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
  minWidth: 0,
};

const rightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 26,
  lineHeight: 1.15,
  fontWeight: 800,
  color: "#0f172a",
  letterSpacing: "-0.5px",
};

const subtitleStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 14,
  color: "#64748b",
  fontWeight: 400,
};

const searchStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 190,
  height: 40,
  borderRadius: 12,
  border: "1.5px solid #e2e8f0",
  background: "#ffffff",
  padding: "0 14px",
  cursor: "text",
};

const userBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const userNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
  lineHeight: 1.2,
};

const userRoleStyle: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  marginTop: 2,
};

const avatarStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
  userSelect: "none",
};
