import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";

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

  const teachers = useMemo(
    () => users.filter((user) => user.role === "teacher"),
    [users]
  );

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

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateGroup = async () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setCreateError("Введите название группы");
      setCreateSuccess("");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError("");
      setCreateSuccess("");

      await api.post("/groups/", {
        name: trimmedName,
        curator_id: curatorId ? Number(curatorId) : null,
      });

      setCreateSuccess("Группа успешно создана");
      setGroupName("");
      setCuratorId("");

      await loadData();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || "Не удалось создать группу");
      setCreateSuccess("");
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Загрузка групп...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link to="/admin">← Назад в админку</Link>
      </div>

      <h1 style={{ marginBottom: 20 }}>Группы</h1>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Создать группу</h2>

        <div style={formGridStyle}>
          <input
            style={inputStyle}
            type="text"
            placeholder="Например, ИС-203"
            value={groupName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value)}
          />

          <select
            style={inputStyle}
            value={curatorId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCuratorId(e.target.value)}
          >
            <option value="">Без куратора</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.last_name} {teacher.first_name} ({teacher.id})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={handleCreateGroup} disabled={createLoading}>
            {createLoading ? "Создание..." : "Создать группу"}
          </button>
        </div>

        {createError && <div style={{ color: "red", marginTop: 12 }}>{createError}</div>}
        {createSuccess && <div style={{ color: "green", marginTop: 12 }}>{createSuccess}</div>}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Список групп</h2>

        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Название</th>
              <th style={thStyle}>Curator ID</th>
              <th style={thStyle}>Создана</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id}>
                <td style={tdStyle}>{group.id}</td>
                <td style={tdStyle}>{group.name}</td>
                <td style={tdStyle}>{group.curator_id ?? "—"}</td>
                <td style={tdStyle}>{group.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 20,
  marginBottom: 24,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "left",
  background: "#f3f4f6",
};

const tdStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
};