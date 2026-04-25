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

// SVG icon components
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <rect x="2" y="20" width="20" height="1" rx="0.5" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function getIcon(to: string, label: string) {
  const path = to.toLowerCase();
  const lbl = label.toLowerCase();

  if (path === "/teacher" || path === "/admin" || path === "/student" || lbl.includes("главная") || lbl.includes("кабинет"))
    return <HomeIcon />;
  if (lbl.includes("пользовател") || lbl.includes("users"))
    return <UsersIcon />;
  if (lbl.includes("групп") || lbl.includes("group"))
    return <GroupsIcon />;
  if (lbl.includes("аналитик") || lbl.includes("analytic") || lbl.includes("chart"))
    return <ChartIcon />;
  return <DotIcon />;
}

export default function Sidebar({ title, links, width }: Props) {
  const location = useLocation();

  const isLinkActive = (to: string) => {
    if (to === "/admin") return location.pathname === "/admin";
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <aside style={{ ...sidebarStyle, width }}>
      <div style={sidebarInnerStyle}>
        <div>
          {/* Brand */}
          <div style={brandWrapStyle}>
            <div style={logoMarkStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L2 8l10 5 10-5-10-5z" fill="white" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
              </svg>
            </div>
            <div>
              <div style={brandTitleStyle}>{title}</div>
              <div style={brandSubtitleStyle}>Engagement Analytics</div>
            </div>
          </div>

          {/* Divider */}
          <div style={dividerStyle} />

          {/* Nav */}
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
                  <span style={{ ...iconWrapStyle, ...(isActive ? activeIconWrapStyle : {}) }}>
                    {getIcon(link.to, link.label)}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 500 }}>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer card */}
        <div style={footerCardStyle}>
          <div style={footerDotStyle} />
          <div>
            <div style={footerTitleStyle}>Student Insight</div>
            <div style={footerTextStyle}>
              Аналитика вовлечённости
            </div>
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
  background: "linear-gradient(180deg, #07162f 0%, #0a1e55 60%, #071d49 100%)",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "4px 0 24px rgba(7, 22, 47, 0.5)",
  overflow: "hidden",
};

const sidebarInnerStyle: CSSProperties = {
  height: "100%",
  padding: "16px 12px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const brandWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "4px 4px 16px",
};

const logoMarkStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 11,
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
};

const brandTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#ffffff",
  lineHeight: 1.2,
};

const brandSubtitleStyle: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  marginTop: 2,
  letterSpacing: "0.3px",
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.07)",
  marginBottom: 12,
  borderRadius: 1,
};

const navStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const navLinkStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 10px",
  textDecoration: "none",
  color: "#94a3b8",
  transition: "background 0.15s, color 0.15s",
};

const activeNavLinkStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.18))",
  boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.25)",
  color: "#fff",
};

const iconWrapStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: "rgba(255,255,255,0.05)",
  color: "#94a3b8",
};

const activeIconWrapStyle: CSSProperties = {
  background: "linear-gradient(135deg, #2563eb, #6366f1)",
  color: "#fff",
  boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
};

const footerCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 10px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const footerDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#22c55e",
  flexShrink: 0,
  boxShadow: "0 0 6px rgba(34,197,94,0.6)",
};

const footerTitleStyle: CSSProperties = {
  color: "#e2e8f0",
  fontWeight: 700,
  fontSize: 13,
};

const footerTextStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  marginTop: 2,
};
