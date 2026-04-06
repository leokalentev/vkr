import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import GroupsPage from "../pages/GroupsPage";
import GroupDetailPage from "../pages/GroupDetailPage";
import StudentPage from "../pages/StudentPage";
import GroupAnalyticsPage from "../pages/GroupAnalyticsPage";
import TeacherHomePage from "../pages/TeacherHomePage";
import ProtectedRoute from "../components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <TeacherHomePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/groups",
    element: (
      <ProtectedRoute>
        <GroupsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/groups/:id",
    element: (
      <ProtectedRoute>
        <GroupDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/groups/:id/analytics",
    element: (
      <ProtectedRoute>
        <GroupAnalyticsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/students/:id",
    element: (
      <ProtectedRoute>
        <StudentPage />
      </ProtectedRoute>
    ),
  },
]);