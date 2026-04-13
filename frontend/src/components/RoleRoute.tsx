import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import api from "../api/client";

type Role = "admin" | "teacher" | "student";

type Props = {
  children: ReactNode;
  allowedRoles: Role[];
};

type MeResponse = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
};

export default function RoleRoute({ children, allowedRoles }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsAllowed(false);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get<MeResponse>("/auth/me");
        setIsAllowed(allowedRoles.includes(res.data.role));
      } catch {
        localStorage.removeItem("token");
        setIsAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [allowedRoles]);

  if (loading) {
    return <div style={{ padding: 20 }}>Проверка доступа...</div>;
  }

  if (!isAllowed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}