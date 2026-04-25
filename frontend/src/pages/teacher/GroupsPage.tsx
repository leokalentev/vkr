import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties } from "react";
import AppShell from "../../components/layout/AppShell";

type Group = {
  id: number;
  name: string;
  curator_id: number | null;
  created_at: string;
};

const teacherLinks = [
  { label: "Главная", to: "/teacher" },
  { label: "Группы", to: "/groups" },
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/groups/")
      .then((res) => setGroups(res.data))
      .catch(() => setError("Не удалось загрузить список групп"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      sidebarTitle="Преподаватель"
      sidebarLinks={teacherLinks}
      pageTitle="Мои группы"
      pageSubtitle="Список учебных групп под вашим управлением"
    >
      {loading ? (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          Загрузка групп...
        </div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : groups.length === 0 ? (
        <div style={emptyCardStyle}>
          <div style={emptyIconStyle}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div style={emptyTitleStyle}>Групп пока нет</div>
          <div style={emptySubtitleStyle}>Создайте первую группу на главной странице</div>
          <Link to="/teacher" style={{ textDecoration: "none" }}>
            <button style={primaryButtonStyle}>Перейти на главную</button>
          </Link>
        </div>
      ) : (
        <div style={gridStyle}>
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function GroupCard({ group }: { group: { id: number; name: string; created_at: string } }) {
  const date = new Date(group.created_at).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div style={cardStyle}>
      <div style={cardIconStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      </div>

      <div style={cardNameStyle}>{group.name}</div>
      <div style={cardMetaStyle}>ID: {group.id} · {date}</div>

      <div style={cardActionsStyle}>
        <Link to={`/groups/${group.id}`} style={{ textDecoration: "none", flex: 1 }}>
          <button style={cardBtnPrimaryStyle}>Открыть</button>
        </Link>
        <Link to={`/groups/${group.id}/analytics`} style={{ textDecoration: "none", flex: 1 }}>
          <button style={cardBtnSecondaryStyle}>Аналитика</button>
        </Link>
      </div>
    </div>
  );
}

// ---- Styles ----
const loadingStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "40px 20px", color: "#64748b", fontSize: 15,
};
const spinnerStyle: CSSProperties = {
  width: 20, height: 20,
  border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb",
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};
const errorStyle: CSSProperties = {
  padding: "16px 20px", borderRadius: 12,
  background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14,
};
const emptyCardStyle: CSSProperties = {
  background: "white", border: "1px solid #e2e8f0", borderRadius: 20,
  padding: "56px 32px", textAlign: "center",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
};
const emptyIconStyle: CSSProperties = {
  width: 72, height: 72, borderRadius: 20,
  background: "#f1f5f9",
  display: "flex", alignItems: "center", justifyContent: "center",
  margin: "0 auto 16px",
};
const emptyTitleStyle: CSSProperties = {
  fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8,
};
const emptySubtitleStyle: CSSProperties = {
  fontSize: 14, color: "#64748b", marginBottom: 24,
};
const primaryButtonStyle: CSSProperties = {
  padding: "11px 24px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
  boxShadow: "0 3px 10px rgba(37,99,235,0.3)",
};
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 16,
};
const cardStyle: CSSProperties = {
  background: "white", border: "1px solid #e2e8f0", borderRadius: 20,
  padding: "22px 22px 18px",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
  display: "flex", flexDirection: "column", gap: 0,
};
const cardIconStyle: CSSProperties = {
  width: 48, height: 48, borderRadius: 14,
  background: "linear-gradient(135deg, #2563eb, #6366f1)",
  display: "flex", alignItems: "center", justifyContent: "center",
  marginBottom: 14,
  boxShadow: "0 4px 12px rgba(37,99,235,0.28)",
};
const cardNameStyle: CSSProperties = {
  fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 6,
};
const cardMetaStyle: CSSProperties = {
  fontSize: 13, color: "#94a3b8", marginBottom: 18,
};
const cardActionsStyle: CSSProperties = {
  display: "flex", gap: 8, marginTop: "auto",
};
const cardBtnPrimaryStyle: CSSProperties = {
  width: "100%", padding: "9px 0", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
};
const cardBtnSecondaryStyle: CSSProperties = {
  width: "100%", padding: "9px 0", borderRadius: 10,
  border: "1.5px solid #e2e8f0", background: "white",
  color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
