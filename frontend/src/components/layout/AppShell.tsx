import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type SidebarLink = {
  label: string;
  to: string;
};

type Props = {
  sidebarTitle: string;
  sidebarLinks: SidebarLink[];
  pageTitle: string;
  pageSubtitle?: string;
  children: ReactNode;
};

export default function AppShell({
  sidebarTitle,
  sidebarLinks,
  pageTitle,
  pageSubtitle,
  children,
}: Props) {
  return (
    <div style={appStyle}>
      <Sidebar title={sidebarTitle} links={sidebarLinks} />

      <div style={mainAreaStyle}>
        <div style={contentWrapperStyle}>
          <Topbar title={pageTitle} subtitle={pageSubtitle} />
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

const appStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  background: "#f8fafc",
};

const mainAreaStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const contentWrapperStyle: CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: 28,
};