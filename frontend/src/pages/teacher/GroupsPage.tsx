import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";
import AppShell from "../../components/layout/AppShell";

type Group = { id: number; name: string; curator_id: number | null; created_at: string };

const teacherLinks = [
  { label: "Главная", to: "/teacher" },
  { label: "Группы", to: "/groups" },
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadGroups = () => {
    setLoading(true);
    api.get<Group[]>("/groups/")
      .then((res) => { setGroups(res.data); setError(""); })
      .catch(() => setError("Не удалось загрузить список групп"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGroups(); }, []);

  const startEdit = (group: Group) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditError("");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditError(""); };

  const handleSaveEdit = async (groupId: number) => {
    const name = editName.trim();
    if (!name) { setEditError("Название не может быть пустым"); return; }
    try {
      setEditLoading(true); setEditError("");
      await api.patch(`/groups/${groupId}`, { name });
      setEditingId(null);
      loadGroups();
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || "Не удалось сохранить");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (groupId: number) => {
    try {
      setDeleteLoading(true);
      await api.delete(`/groups/${groupId}`);
      setConfirmDeleteId(null);
      loadGroups();
    } catch {
      setConfirmDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AppShell
      sidebarTitle="Преподаватель"
      sidebarLinks={teacherLinks}
      pageTitle="Мои группы"
      pageSubtitle="Список учебных групп под вашим управлением"
    >
      {loading ? (
        <div style={loadingStyle}><div style={spinnerStyle} />Загрузка групп...</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : groups.length === 0 ? (
        <div style={emptyCardStyle}>
          <div style={emptyIconStyle}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
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
          {groups.map((group) => {
            const isEditing = editingId === group.id;
            const isConfirmDelete = confirmDeleteId === group.id;
            const date = new Date(group.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

            return (
              <div key={group.id} style={{ ...cardStyle, ...(isEditing || isConfirmDelete ? { borderColor: isConfirmDelete ? "#fecaca" : "#bfdbfe", background: isConfirmDelete ? "#fef2f2" : "#f0f9ff" } : {}) }}>
                {isEditing ? (
                  <>
                    <div style={cardIconStyle}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Редактирование</div>
                    <input
                      style={editInputStyle}
                      value={editName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                      placeholder="Название группы"
                      autoFocus
                    />
                    {editError && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{editError}</div>}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={() => handleSaveEdit(group.id)} disabled={editLoading} style={saveButtonStyle}>
                        {editLoading ? "..." : "Сохранить"}
                      </button>
                      <button onClick={cancelEdit} style={cancelButtonStyle}>Отмена</button>
                    </div>
                  </>
                ) : isConfirmDelete ? (
                  <>
                    <div style={{ ...cardIconStyle, background: "linear-gradient(135deg,#dc2626,#f87171)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 8 }}>{group.name}</div>
                    <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 14 }}>Удалить группу? Это действие нельзя отменить.</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleDelete(group.id)} disabled={deleteLoading} style={deleteConfirmButtonStyle}>
                        {deleteLoading ? "..." : "Да, удалить"}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} style={cancelButtonStyle}>Отмена</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={cardIconStyle}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </div>
                    <div style={cardNameStyle}>{group.name}</div>
                    <div style={cardMetaStyle}>ID: {group.id} · {date}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                      <Link to={`/groups/${group.id}`} style={{ textDecoration: "none", flex: 1 }}>
                        <button style={cardBtnPrimaryStyle}>Открыть</button>
                      </Link>
                      <Link to={`/groups/${group.id}/analytics`} style={{ textDecoration: "none", flex: 1 }}>
                        <button style={cardBtnSecondaryStyle}>Аналитика</button>
                      </Link>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => startEdit(group)} style={editButtonStyle}>Изменить</button>
                      <button onClick={() => { setConfirmDeleteId(group.id); setEditingId(null); }} style={deleteButtonStyle}>Удалить</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

// ---- Styles ----
const loadingStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "40px 20px", color: "#64748b", fontSize: 15 };
const spinnerStyle: CSSProperties = { width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
const errorStyle: CSSProperties = { padding: "16px 20px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14 };
const emptyCardStyle: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "56px 32px", textAlign: "center", boxShadow: "0 4px 20px rgba(15,23,42,0.05)" };
const emptyIconStyle: CSSProperties = { width: 72, height: 72, borderRadius: 20, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" };
const emptyTitleStyle: CSSProperties = { fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 };
const emptySubtitleStyle: CSSProperties = { fontSize: 14, color: "#64748b", marginBottom: 24 };
const primaryButtonStyle: CSSProperties = { padding: "11px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 3px 10px rgba(37,99,235,0.3)" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 };
const cardStyle: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "22px 22px 18px", boxShadow: "0 4px 20px rgba(15,23,42,0.05)", display: "flex", flexDirection: "column" };
const cardIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#2563eb,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: "0 4px 12px rgba(37,99,235,0.28)" };
const cardNameStyle: CSSProperties = { fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 6 };
const cardMetaStyle: CSSProperties = { fontSize: 13, color: "#94a3b8", marginBottom: 18 };
const cardBtnPrimaryStyle: CSSProperties = { width: "100%", padding: "9px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.25)" };
const cardBtnSecondaryStyle: CSSProperties = { width: "100%", padding: "9px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "white", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const editButtonStyle: CSSProperties = { flex: 1, padding: "7px 0", background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" };
const deleteButtonStyle: CSSProperties = { flex: 1, padding: "7px 0", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" };
const editInputStyle: CSSProperties = { width: "100%", padding: "10px 12px", border: "1.5px solid #bfdbfe", borderRadius: 10, fontSize: 14, background: "#fff", boxSizing: "border-box", outline: "none" };
const saveButtonStyle: CSSProperties = { flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const cancelButtonStyle: CSSProperties = { flex: 1, padding: "9px 0", background: "white", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const deleteConfirmButtonStyle: CSSProperties = { flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#dc2626,#f87171)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" };
