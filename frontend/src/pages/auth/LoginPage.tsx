import { useEffect, useState } from "react";
import api from "../../api/client";

type MeResponse = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "teacher" | "student" | "admin";
  is_active: boolean;
  created_at: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const tryRestoreSession = async () => {
      try {
        const res = await api.get<MeResponse>("/auth/me");
        redirectByRole(res.data.role);
      } catch {
        localStorage.removeItem("token");
      }
    };

    tryRestoreSession();
  }, []);

  const redirectByRole = (role: MeResponse["role"]) => {
    if (role === "teacher") {
      window.location.href = "/teacher";
      return;
    }

    if (role === "student") {
      window.location.href = "/student";
      return;
    }

    if (role === "admin") {
      window.location.href = "/admin";
      return;
    }

    window.location.href = "/";
  };

  const handleLogin = async () => {
    try {
      setError("");

      const loginRes = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", loginRes.data.access_token);

      const meRes = await api.get<MeResponse>("/auth/me");
      redirectByRole(meRes.data.role);
    } catch {
      setError("Неверный логин или пароль");
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "100px auto" }}>
      <h1 style={{ marginBottom: 12 }}>Вход в систему</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Введите email и пароль
      </p>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          marginBottom: 12,
          padding: 10,
          border: "1px solid #ccc",
          borderRadius: 8,
        }}
      />

      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          marginBottom: 12,
          padding: 10,
          border: "1px solid #ccc",
          borderRadius: 8,
        }}
      />

      {error && (
        <div style={{ color: "red", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button onClick={handleLogin}>
        Войти
      </button>
    </div>
  );
}