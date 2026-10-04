import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./api/AuthContext";
import Layout from "./components/Layout";
import RequireRole from "./components/RequireRole";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Catalog from "./pages/Catalog";
import MyLoans from "./pages/MyLoans";
import LibrarianHubDashboard from "./pages/LibrarianHubDashboard";
import ManageBooks from "./pages/ManageBooks";
import IssueReturnBooks from "./pages/IssueReturnBooks";
import AllLoans from "./pages/AllLoans";
import LibrarianFines from "./pages/LibrarianFines";
import BookRequests from "./pages/BookRequests";
import AdminDashboard from "./pages/AdminDashboard";
import ManageStaff from "./pages/ManageStaff";
import Reports from "./pages/Reports";
import SystemSettings from "./pages/SystemSettings";
import HomeRedirect from "./components/HomeRedirect";
import Profile from "./pages/Profile";
import MyFines from "./pages/MyFines";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no sidebar, no layout */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Everything below is nested inside Layout, which renders the
              Sidebar once and keeps it mounted. Only the <Outlet /> content
              (these child routes) changes as the user navigates. */}
          <Route element={<Layout />}>
            {/* Any logged-in role can access these */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/my-loans" element={<MyLoans />} />
            <Route path="/my-fines" element={<MyFines />} />
            <Route path="/profile" element={<Profile />} />

            {/* Librarian + Admin only */}
            <Route
              path="/dashboard"
              element={
                <RequireRole roles={["librarian", "admin"]}>
                  <LibrarianHubDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/manage-books"
              element={
                <RequireRole roles={["librarian", "admin"]}>
                  <ManageBooks />
                </RequireRole>
              }
            />
            <Route
              path="/issue-return"
              element={
                <RequireRole roles={["librarian", "admin"]}>
                  <IssueReturnBooks />
                </RequireRole>
              }
            />
            <Route
              path="/all-loans"
              element={
                <RequireRole roles={["librarian", "admin"]}>
                  <AllLoans />
                </RequireRole>
              }
            />
            <Route
              path="/librarian-fines"
              element={
                <RequireRole roles={["librarian", "admin"]}>
                  <LibrarianFines />
                </RequireRole>
              }
            />
            <Route
              path="/book-requests"
              element={
                <RequireRole roles={["librarian", "admin"]}>
                  <BookRequests />
                </RequireRole>
              }
            />

            {/* Admin only */}
            <Route
              path="/admin-dashboard"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/manage-staff"
              element={
                <RequireRole roles={["admin"]}>
                  <ManageStaff />
                </RequireRole>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireRole roles={["admin"]}>
                  <Reports />
                </RequireRole>
              }
            />
            <Route
              path="/system-settings"
              element={
                <RequireRole roles={["admin"]}>
                  <SystemSettings />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
