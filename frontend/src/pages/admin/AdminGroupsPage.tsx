import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";
import AppShell from "../../components/layout/AppShell";

type UserRole = "admin" | "teacher" | "student";

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

type Group = {
  id: number;
  name: string;
  curator_id: number | null;
  created_at: string;
};

const adminLinks = [
  { label: "Главная", to: "/admin", icon: "🏠" },
  { label: "Пользователи", to: "/admin/users", icon: "👥" },
  { label: "Группы", to: "/admin/groups", icon: "🎓" },
];

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [groupName, setGroupName] = useState("");
  const [curatorId, setCuratorId] = useState<string>("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCuratorId, setEditCuratorId] = useState<string>("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const teachers = useMemo(() => users.filter((u) => u.role === "teacher"), [users]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsRes, usersRes] = await Promise.all([
        api.get<Group[]>("/groups/"),
        api.get<User[]>("/users/"),
      ]);
      setGroups(groupsRes.data);
      setUsers(usersRes.data);
      setError("");
    } catch {
      setError("Не удалось загрузить группы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) { setCreateError("Введите название группы"); return; }
    try {
      setCreateLoading(true); setCreateError(""); setCreateSuccess("");
      await api.post("/groups/", { name, curator_id: curatorId ? Number(curatorId) : null });
      setCreateSuccess("Группа успешно создана");
      setGroupName(""); setCuratorId("");
      await loadData();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || "Не удалось создать группу");
    } finally {
      setCreateLoading(false);
    }
  };

  const startEdit = (group: Group) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditCuratorId(group.curator_id ? String(group.curator_id) : "");
    setEditError("");
  };

  const cancelEdit = () => { setEditingId(null); setEditError(""); };

  const handleSaveEdit = async (groupId: number) => {
    const name = editName.trim();
    if (!name) { setEditError("Название не может быть пустым"); return; }
    try {
      setEditLoading(true); setEditError("");
      await api.patch(`/groups/${groupId}`, {
        name,
        curator_id: editCuratorId ? Number(editCuratorId) : null,
      });
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || "Не удалось сохранить изменения");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (groupId: number) => {
    try {
      setDeleteLoading(true);
      await api.delete(`/groups/${groupId}`);
      setConfirmDeleteId(null);
      await loadData();
    } catch {
      setConfirmDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getTeacherName = (id: number | null) => {
    if (!id) return null;
    const t = teachers.find((t) => t.id === id);
    return t ? `${t.last_name} ${t.first_name}` : `ID: ${id}`;
  };

  return (
    <AppShell
      sidebarTitle="Администратор"
      sidebarLinks={adminLinks}
      pageTitle="Учебные группы"
      pageSubtitle="Создание и управление академическими группами"
    >
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 20px", color: "#64748b", fontSize: 15 }}>
          <div style={{ width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Загрузка групп...
        </div>
      ) : (
        <>
          {/* Create */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Создать группу</h2>
            <p style={sectionSubtitleStyle}>Укажите название группы и при необходимости назначьте куратора</p>
            <div style={{ ...formGridStyle, marginTop: 18 }}>
              <input style={inputStyle} type="text" placeholder="Например, ИС-203" value={groupName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value)} />
              <select style={inputStyle} value={curatorId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCuratorId(e.target.value)}>
                <option value="">Без куратора</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 18 }}>
              <button onClick={handleCreate} disabled={createLoading} style={primaryButtonStyle}>
                {createLoading ? "Создание..." : "Создать группу"}
              </button>
            </div>
            {createError && <div style={messageErrorStyle}>{createError}</div>}
            {createSuccess && <div style={messageSuccessStyle}>{createSuccess}</div>}
          </div>

          {/* List */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Список групп</h2>
            <p style={sectionSubtitleStyle}>Все учебные группы, зарегистрированные в системе</p>
            {error && <div style={messageErrorStyle}>{error}</div>}
            {groups.length === 0 ? (
              <div style={emptyStateStyle}>Группы пока не созданы</div>
            ) : (
              <div style={{ ...tableWrapperStyle, marginTop: 16 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Название</th>
                      <th style={thStyle}>Куратор</th>
                      <th style={thStyle}>Дата создания</th>
                      <th style={thStyle}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      editingId === group.id ? (
                        <tr key={group.id} style={{ background: "#f8fafc" }}>
                          <td style={tdStyle} colSpan={5}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <input style={{ ...inputStyle, maxWidth: 200 }} value={editName}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                placeholder="Название группы" />
                              <select style={{ ...inputStyle, maxWidth: 220 }} value={editCuratorId}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => setEditCuratorId(e.target.value)}>
                                <option value="">Без куратора</option>
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
                                ))}
                              </select>
                              <button onClick={() => handleSaveEdit(group.id)} disabled={editLoading} style={saveButtonStyle}>
                                {editLoading ? "Сохранение..." : "Сохранить"}
                              </button>
                              <button onClick={cancelEdit} style={cancelButtonStyle}>Отмена</button>
                              {editError && <span style={{ color: "#dc2626", fontSize: 13 }}>{editError}</span>}
                            </div>
                          </td>
                        </tr>
                      ) : confirmDeleteId === group.id ? (
                        <tr key={group.id} style={{ background: "#fef2f2" }}>
                          <td style={tdStyle} colSpan={5}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, color: "#dc2626", fontWeight: 600 }}>
                                Удалить группу «{group.name}»? Это действие нельзя отменить.
                              </span>
                              <button onClick={() => handleDelete(group.id)} disabled={deleteLoading} style={deleteConfirmButtonStyle}>
                                {deleteLoading ? "Удаление..." : "Да, удалить"}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} style={cancelButtonStyle}>Отмена</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={group.id}>
                          <td style={tdStyle}>{group.id}</td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{group.name}</div>
                          </td>
                          <td style={tdStyle}>
                            {group.curator_id
                              ? <span style={badgeBlueStyle}>{getTeacherName(group.curator_id)}</span>
                              : <span style={badgeGrayStyle}>Не назначен</span>}
                          </td>
                          <td style={tdStyle}>{new Date(group.created_at).toLocaleString("ru-RU")}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => startEdit(group)} style={editButtonStyle}>Изменить</button>
                              <button onClick={() => setConfirmDeleteId(group.id)} style={deleteButtonStyle}>Удалить</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

const cardStyle: CSSProperties = { background: "rgba(255,255,255,0.88)", border: "1px solid #e2e8f0", borderRadius: 18, padding: 22, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)" };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" };
const sectionSubtitleStyle: CSSProperties = { margin: "8px 0 0", fontSize: 14, color: "#64748b" };
const formGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 };
const inputStyle: CSSProperties = { width: "100%", padding: "12px 14px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" };
const primaryButtonStyle: CSSProperties = { background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const saveButtonStyle: CSSProperties = { background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const cancelButtonStyle: CSSProperties = { background: "white", color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const editButtonStyle: CSSProperties = { background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const deleteButtonStyle: CSSProperties = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const deleteConfirmButtonStyle: CSSProperties = { background: "linear-gradient(135deg,#dc2626,#f87171)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const messageErrorStyle: CSSProperties = { marginTop: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 14px" };
const messageSuccessStyle: CSSProperties = { marginTop: 12, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 14px" };
const tableWrapperStyle: CSSProperties = { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const thStyle: CSSProperties = { textAlign: "left", padding: "11px 16px", background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" };
const tdStyle: CSSProperties = { padding: "14px 16px", borderBottom: "1px solid #e2e8f0", color: "#0f172a" };
const badgeBlueStyle: CSSProperties = { display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8" };
const badgeGrayStyle: CSSProperties = { display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "#f1f5f9", color: "#475569" };
const emptyStateStyle: CSSProperties = { padding: "24px 16px", textAlign: "center", color: "#64748b" };
