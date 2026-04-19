import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  color?: "blue" | "green" | "red" | "gray" | "purple" | "orange";
};

const palette: Record<NonNullable<Props["color"]>, CSSProperties> = {
  blue: {
    background: "#dbeafe",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },
  green: {
    background: "#dcfce7",
    color: "#15803d",
    border: "1px solid #bbf7d0",
  },
  red: {
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },
  gray: {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },
  purple: {
    background: "#ede9fe",
    color: "#6d28d9",
    border: "1px solid #ddd6fe",
  },
  orange: {
    background: "#ffedd5",
    color: "#c2410c",
    border: "1px solid #fdba74",
  },
};

export default function Badge({ children, color = "gray" }: Props) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        ...palette[color],
      }}
    >
      {children}
    </span>
  );
}