import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import Sidebar from "./Sidebar";

// This is a "layout route" — react-router renders it once, and it stays
// mounted while only the <Outlet /> content underneath swaps as the user
// navigates between pages. That's what keeps the Sidebar fixed in place.
export default function Layout() {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-8 text-sm text-gray-500">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <Sidebar />
      <main className="flex-1 px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
