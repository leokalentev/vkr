import type { CSSProperties } from "react";

export const pageSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

export const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
};

export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  color: "#0f172a",
};

export const sectionSubtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#64748b",
};

export const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

export const statCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

export const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};

export const primaryButtonStyle: CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(37, 99, 235, 0.25)",
};

export const secondaryButtonStyle: CSSProperties = {
  background: "#eef2ff",
  color: "#3730a3",
  border: "1px solid #c7d2fe",
  borderRadius: 12,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

export const tableWrapperStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
};

export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 14,
};

export const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 700,
  borderBottom: "1px solid #e2e8f0",
};

export const tdStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  verticalAlign: "middle",
};

export const emptyStateStyle: CSSProperties = {
  padding: "24px 16px",
  textAlign: "center",
  color: "#64748b",
};

export const messageErrorStyle: CSSProperties = {
  marginTop: 12,
  color: "#b91c1c",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 12,
  padding: "12px 14px",
};

export const messageSuccessStyle: CSSProperties = {
  marginTop: 12,
  color: "#166534",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 12,
  padding: "12px 14px",
};