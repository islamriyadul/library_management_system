import { Navigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import StudentDashboard from "../pages/StudentDashboard";

// Traffic director for "/" — routes each role to its own real dashboard.
// All three (Student, Librarian, Admin) are now built.
export default function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-8 text-sm text-gray-500">Loading...</p>;
  if (!user) return null; // ProtectedRoute above this already handles redirecting to /login

  if (user.role === "student") {
    return <StudentDashboard />;
  }

  if (user.role === "librarian") {
    return <Navigate to="/dashboard" replace />;
  }

  // Admin
  return <Navigate to="/admin-dashboard" replace />;
}
