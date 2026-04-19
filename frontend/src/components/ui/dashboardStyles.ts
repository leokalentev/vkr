import type { CSSProperties } from "react";

export const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  gap: 20,
};

export const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 18,
};

export const twoColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "380px minmax(0, 1fr)",
  gap: 20,
  alignItems: "start",
};

export const panelStyle: CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.06)",
  backdropFilter: "blur(14px)",
};

export const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
  color: "#0f172a",
};

export const panelSubtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#64748b",
};

export const formGridStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 18,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.24)",
  padding: "0 14px",
  background: "#ffffff",
  boxSizing: "border-box",
  outline: "none",
  fontSize: 14,
};

export const buttonPrimaryStyle: CSSProperties = {
  height: 48,
  padding: "0 18px",
  borderRadius: 16,
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 14px 28px rgba(79, 70, 229, 0.25)",
};

export const buttonGhostStyle: CSSProperties = {
  height: 48,
  padding: "0 18px",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.24)",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 700,
};

export const statCardStyle: CSSProperties = {
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 16px 35px rgba(15, 23, 42, 0.05)",
};

export const statLabelStyle: CSSProperties = {
  fontSize: 14,
  color: "#64748b",
  marginBottom: 10,
};

export const statValueStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  color: "#0f172a",
};

export const tableWrapStyle: CSSProperties = {
  marginTop: 18,
  overflowX: "auto",
  borderRadius: 20,
  border: "1px solid rgba(148,163,184,0.16)",
  background: "#ffffff",
};

export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

export const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "16px 18px",
  fontSize: 13,
  color: "#64748b",
  fontWeight: 800,
  borderBottom: "1px solid #eef2f7",
  background: "#fbfdff",
};

export const tdStyle: CSSProperties = {
  padding: "16px 18px",
  fontSize: 14,
  color: "#0f172a",
  borderBottom: "1px solid #f1f5f9",
};

export const badgeBlueStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: "#e0ecff",
  color: "#1d4ed8",
  fontWeight: 700,
  fontSize: 12,
};

export const badgeGrayStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#475569",
  fontWeight: 700,
  fontSize: 12,
};

export const messageErrorStyle: CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 16,
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
};

export const messageSuccessStyle: CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 16,
  background: "#f0fdf4",
  color: "#15803d",
  border: "1px solid #bbf7d0",
};