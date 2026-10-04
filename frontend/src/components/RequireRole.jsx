import { Navigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

// Used INSIDE the Layout's <Outlet /> for pages restricted to certain
// roles (e.g. Librarian/Admin-only pages, Admin-only pages). The Sidebar
// from Layout is already rendered by this point either way.
export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
