import { useState } from "react";
import api from "../api/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.access_token);

      // редирект
      window.location.href = "/";
    } catch (e: any) {
      setError("Неверный логин или пароль");
    }
  };

  return (
    <div className="flex justify-center mt-20">
      <div className="w-96 rounded-xl bg-white p-6 shadow">
        <h2 className="mb-4 text-2xl font-semibold">Вход</h2>

        <input
          className="mb-3 w-full rounded border p-2"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="mb-3 w-full rounded border p-2"
          placeholder="Пароль"
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="mb-3 text-red-500">{error}</div>}

        <button
          onClick={handleLogin}
          className="w-full rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
        >
          Войти
        </button>
      </div>
    </div>
  );
}