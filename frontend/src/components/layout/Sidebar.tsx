import { Link, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";

type SidebarLink = {
  label: string;
  to: string;
  icon?: string;
};

type Props = {
  title: string;
  links: SidebarLink[];
  width: number;
};

export default function Sidebar({ title, links, width }: Props) {
  const location = useLocation();

  const isLinkActive = (to: string) => {
    if (to === "/admin") {
      return location.pathname === "/admin";
    }

    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <aside
      style={{
        ...sidebarStyle,
        width,
      }}
    >
      <div style={sidebarInnerStyle}>
        <div>
          <div style={brandWrapStyle}>
            <div>
              <div style={brandTitleStyle}>{title}</div>
              <div style={brandSubtitleStyle}>Engagement Analytics</div>
            </div>
          </div>

          <nav style={navStyle}>
            {links.map((link) => {
              const isActive = isLinkActive(link.to);

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    ...navLinkStyle,
                    ...(isActive ? activeNavLinkStyle : {}),
                  }}
                >
                  <span style={iconStyle}>{link.icon ?? "•"}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={footerCardStyle}>
          <div style={footerTitleStyle}>Student Insight</div>
          <div style={footerTextStyle}>
            Управление пользователями, группами и аналитикой вовлечённости
          </div>
        </div>
      </div>
    </aside>
  );
}

const sidebarStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  bottom: 0,
  zIndex: 100,
  background: "linear-gradient(180deg, #07162f 0%, #071d49 100%)",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "10px 0 30px rgba(15, 23, 42, 0.12)",
  overflow: "hidden",
};

const sidebarInnerStyle: CSSProperties = {
  height: "100%",
  padding: 14,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const brandWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  marginBottom: 24,
};

const brandTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#ffffff",
  lineHeight: 1.15,
};

const brandSubtitleStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#94a3b8",
};

const navStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const navLinkStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 14px",
  textDecoration: "none",
  color: "#dbeafe",
  fontWeight: 700,
  transition: "0.2s ease",
};

const activeNavLinkStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(59,130,246,.22), rgba(99,102,241,.22))",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  color: "#fff",
};

const iconStyle: CSSProperties = {
  width: 18,
  textAlign: "center",
  fontSize: 16,
};

const footerCardStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const footerTitleStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  marginBottom: 8,
};

const footerTextStyle: CSSProperties = {
  color: "#a5b4fc",
  fontSize: 12,
  lineHeight: 1.45,
};