import type { CSSProperties, ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type SidebarLink = {
  label: string;
  to: string;
  icon?: string;
};

type Props = {
  sidebarTitle: string;
  sidebarLinks: SidebarLink[];
  pageTitle: string;
  pageSubtitle?: string;
  children: ReactNode;
};

const SIDEBAR_WIDTH = 230;

export default function AppShell({
  sidebarTitle,
  sidebarLinks,
  pageTitle,
  pageSubtitle,
  children,
}: Props) {
  return (
    <div style={rootStyle}>
      <Sidebar title={sidebarTitle} links={sidebarLinks} width={SIDEBAR_WIDTH} />

      <main
        style={{
          ...mainStyle,
          marginLeft: SIDEBAR_WIDTH,
        }}
      >
        <div style={contentStyle}>
          <Topbar title={pageTitle} subtitle={pageSubtitle} />
          <section style={pageBodyStyle}>{children}</section>
        </div>
      </main>
    </div>
  );
}

const rootStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #f8fbff 0%, #f3f6fb 45%, #f6f2ff 100%)",
};

const mainStyle: CSSProperties = {
  minHeight: "100vh",
};

const contentStyle: CSSProperties = {
  width: "100%",
  margin: 0,
  padding: "20px 24px 28px 16px",
  boxSizing: "border-box",
};

const pageBodyStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 24,
};