import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

type Group = {
  id: number;
  name: string;
  curator_id: number | null;
  created_at: string;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await api.get("/groups/");
        setGroups(res.data);
      } catch {
        setError("Не удалось загрузить список групп");
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Загрузка групп...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1>Группы</h1>
        <button onClick={handleLogout}>Выйти</button>
      </div>

      {groups.length === 0 ? (
        <p>Групп пока нет</p>
      ) : (
        <ul>
          {groups.map((group) => (
            <li key={group.id} style={{ marginBottom: 14 }}>
              <Link to={`/groups/${group.id}`} style={{ fontWeight: 600 }}>
                {group.name}
              </Link>{" "}
              <span style={{ color: "#666" }}>(id: {group.id})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}