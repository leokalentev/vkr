import type { CSSProperties } from "react";

type Props = {
  title: string;
  subtitle?: string;
};

export default function Topbar({ title, subtitle }: Props) {
  return (
    <header style={topbarStyle}>
      <div style={leftStyle}>
        <div>
          <h1 style={titleStyle}>{title}</h1>
          {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        </div>
      </div>

      <div style={rightStyle}>
        <div style={searchStyle}>⌕ Поиск по системе</div>
        <button style={actionButtonStyle}>Экспорт</button>
        <div style={avatarStyle}>М</div>
      </div>
    </header>
  );
}

const topbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 20,
  width: "100%",
};

const leftStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
};

const rightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 15,
  color: "#64748b",
};

const searchStyle: CSSProperties = {
  minWidth: 210,
  height: 42,
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#94a3b8",
  display: "flex",
  alignItems: "center",
  padding: "0 14px",
  fontSize: 14,
};

const actionButtonStyle: CSSProperties = {
  height: 42,
  padding: "0 16px",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
};

const avatarStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  boxShadow: "0 8px 20px rgba(249,115,22,0.25)",
};