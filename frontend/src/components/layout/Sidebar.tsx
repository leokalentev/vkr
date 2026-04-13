import { Link, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";

type SidebarLink = {
  label: string;
  to: string;
};

type Props = {
  title: string;
  links: SidebarLink[];
};

export default function Sidebar({ title, links }: Props) {
  const location = useLocation();

  return (
    <aside style={sidebarStyle}>
      <div style={brandStyle}>
        <div style={brandTitleStyle}>{title}</div>
        <div style={brandSubtitleStyle}>Student Engagement System</div>
      </div>

      <nav style={navStyle}>
        {links.map((link) => {
          const isActive =
            location.pathname === link.to ||
            (link.to !== "/" && location.pathname.startsWith(link.to));

          return (
            <Link
              key={link.to}
              to={link.to}
              style={{
                ...linkStyle,
                ...(isActive ? activeLinkStyle : {}),
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

const sidebarStyle: CSSProperties = {
  width: 260,
  minWidth: 260,
  background: "#0f172a",
  color: "white",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid #1e293b",
};

const brandStyle: CSSProperties = {
  marginBottom: 28,
  paddingBottom: 20,
  borderBottom: "1px solid #1e293b",
};

const brandTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginBottom: 6,
};

const brandSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
};

const navStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const linkStyle: CSSProperties = {
  color: "#e2e8f0",
  textDecoration: "none",
  padding: "12px 14px",
  borderRadius: 10,
  transition: "0.2s",
};

const activeLinkStyle: CSSProperties = {
  background: "#1e293b",
  color: "#ffffff",
  fontWeight: 600,
};