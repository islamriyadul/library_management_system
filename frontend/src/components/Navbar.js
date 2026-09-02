import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        University Library
      </Link>
      <div className="nav-links">
        <Link to="/">Catalog</Link>
        {user && !user.is_librarian && <Link to="/my-loans">My Loans</Link>}
        {user && user.is_librarian && <Link to="/dashboard">Dashboard</Link>}
        {user ? (
          <>
            <span className="nav-user">
              {user.username} {user.is_librarian && "(Librarian)"}
            </span>
            <button onClick={handleLogout}>Log Out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log In</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
