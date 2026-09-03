import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./api/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Catalog from "./pages/Catalog";
import MyLoans from "./pages/MyLoans";
import LibrarianDashboard from "./pages/LibrarianDashboard";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
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
            path="/dashboard"
            element={
              <ProtectedRoute librarianOnly>
                <LibrarianDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
