import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./api/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Catalog from "./pages/Catalog";
import MyLoans from "./pages/MyLoans";
import LibrarianHubDashboard from "./pages/LibrarianHubDashboard";
import ManageBooks from "./pages/ManageBooks";
import IssueReturnBooks from "./pages/IssueReturnBooks";
import AllLoans from "./pages/AllLoans";
import LibrarianFines from "./pages/LibrarianFines";
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog"
            element={
              <ProtectedRoute>
                <Catalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-loans"
            element={
              <ProtectedRoute>
                <MyLoans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-fines"
            element={
              <ProtectedRoute>
                <MyFines />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute librarianOnly>
                <LibrarianHubDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-books"
            element={
              <ProtectedRoute librarianOnly>
                <ManageBooks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/issue-return"
            element={
              <ProtectedRoute librarianOnly>
                <IssueReturnBooks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/all-loans"
            element={
              <ProtectedRoute librarianOnly>
                <AllLoans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/librarian-fines"
            element={
              <ProtectedRoute librarianOnly>
                <LibrarianFines />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-staff"
            element={
              <ProtectedRoute adminOnly>
                <ManageStaff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute adminOnly>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/system-settings"
            element={
              <ProtectedRoute adminOnly>
                <SystemSettings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
