import { Navigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

export default function ProtectedRoute({ children, librarianOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="page">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (librarianOnly && !user.is_librarian) return <Navigate to="/" replace />;

  return children;
}
