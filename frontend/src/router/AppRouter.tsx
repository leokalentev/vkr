import { createBrowserRouter } from "react-router-dom";

import LoginPage from "../pages/auth/LoginPage";

import TeacherHomePage from "../pages/teacher/TeacherHomePage";
import GroupsPage from "../pages/teacher/GroupsPage";
import GroupDetailPage from "../pages/teacher/GroupDetailPage";
import GroupAnalyticsPage from "../pages/teacher/GroupAnalyticsPage";
import StudentPage from "../pages/teacher/StudentPage";

import StudentHomePage from "../pages/student/StudentHomePage";

import AdminHomePage from "../pages/admin/AdminHomePage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import AdminGroupsPage from "../pages/admin/AdminGroupsPage";

import RoleRoute from "../components/RoleRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },

  {
    path: "/teacher",
    element: (
      <RoleRoute allowedRoles={["teacher"]}>
        <TeacherHomePage />
      </RoleRoute>
    ),
  },
  {
    path: "/groups",
    element: (
      <RoleRoute allowedRoles={["teacher", "admin"]}>
        <GroupsPage />
      </RoleRoute>
    ),
  },
  {
    path: "/groups/:id",
    element: (
      <RoleRoute allowedRoles={["teacher", "admin"]}>
        <GroupDetailPage />
      </RoleRoute>
    ),
  },
  {
    path: "/groups/:id/analytics",
    element: (
      <RoleRoute allowedRoles={["teacher", "admin"]}>
        <GroupAnalyticsPage />
      </RoleRoute>
    ),
  },
  {
    path: "/students/:id",
    element: (
      <RoleRoute allowedRoles={["teacher", "admin"]}>
        <StudentPage />
      </RoleRoute>
    ),
  },

  {
    path: "/student",
    element: (
      <RoleRoute allowedRoles={["student"]}>
        <StudentHomePage />
      </RoleRoute>
    ),
  },

  {
    path: "/admin",
    element: (
      <RoleRoute allowedRoles={["admin"]}>
        <AdminHomePage />
      </RoleRoute>
    ),
  },
  {
    path: "/admin/users",
    element: (
      <RoleRoute allowedRoles={["admin"]}>
        <AdminUsersPage />
      </RoleRoute>
    ),
  },
  {
    path: "/admin/groups",
    element: (
      <RoleRoute allowedRoles={["admin"]}>
        <AdminGroupsPage />
      </RoleRoute>
    ),
  },

  {
    path: "*",
    element: <LoginPage />,
  },
]);