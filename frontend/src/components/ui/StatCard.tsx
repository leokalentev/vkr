import type { CSSProperties, ReactNode } from "react";
import { statCardStyle } from "./adminStyles";

type Props = {
  title: string;
  value: string;
  icon?: ReactNode;
  hint?: string;
};

export default function StatCard({ title, value, icon, hint }: Props) {
  return (
    <div style={statCardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a" }}>
            {value}
          </div>
          {hint && (
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
              {hint}
            </div>
          )}
        </div>

        {icon && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "#eff6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb",
              fontWeight: 700,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}