import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../api/AuthContext";

export default function Catalog() {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  // bookId -> id of this student's pending request for that book
  const [pendingByBook, setPendingByBook] = useState({});
  const [requestingId, setRequestingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [toast, setToast] = useState("");

  const loadMyRequests = () => {
    if (user?.role !== "student") return;
    api.get("/book-requests/mine/").then((res) => {
      const map = {};
      res.data
        .filter((r) => r.status === "pending")
        .forEach((r) => {
          map[r.book] = r.id;
        });
      setPendingByBook(map);
    }).catch(() => {});
  };

  const fetchBooks = async (query = "") => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.get("/books/", {
        params: query ? { search: query } : {},
      });
      setBooks(res.data);
    } catch (err) {
      setErrorMsg("Could not load books.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    loadMyRequests();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBooks(search);
  };

  const handleRequest = async (bookId) => {
    setRequestingId(bookId);
    setToast("");
    try {
      await api.post("/book-requests/create/", { book: bookId });
      setToast("Request sent — waiting on a librarian to approve it.");
      loadMyRequests();
    } catch (err) {
      setToast(err.response?.data?.detail || "Couldn't send the request.");
    } finally {
      setRequestingId(null);
    }
  };

  const handleCancel = async (bookId) => {
    const requestId = pendingByBook[bookId];
    if (!requestId) return;
    setCancellingId(bookId);
    setToast("");
    try {
      await api.post(`/book-requests/${requestId}/cancel/`);
      setToast("Request cancelled.");
      loadMyRequests();
    } catch (err) {
      // Most likely the librarian approved/rejected it a moment ago. Show
      // the server's reason, then re-sync so the page shows the real state
      // (including the book's availability, which approval changes).
      setToast(err.response?.data?.detail || "Couldn't cancel the request.");
      loadMyRequests();
      fetchBooks(search);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="page">
      <h2>Book Catalog</h2>
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          placeholder="Search by title, author, or ISBN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {loading && <p>Loading books...</p>}
      {errorMsg && <p className="error-text">{errorMsg}</p>}
      {toast && <p style={{ color: "#1d4ed8", fontSize: "0.875rem" }}>{toast}</p>}

      {!loading && books.length === 0 && <p>No books found.</p>}

      <div className="book-grid">
        {books.map((book) => (
          <div className="book-card" key={book.id}>
            <div
              style={{
                width: "100%",
                height: "140px",
                marginBottom: "0.5rem",
                borderRadius: "6px",
                overflow: "hidden",
                background: "#f1f1f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {book.cover_image ? (
                <img
                  src={book.cover_image}
                  alt={book.title}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: "0.75rem", color: "#999" }}>No cover</span>
              )}
            </div>
            <h3>{book.title}</h3>
            <p className="book-author">by {book.author}</p>
            <p className="book-meta">ISBN: {book.isbn}</p>
            {book.subject && <p className="book-meta">Subject: {book.subject}</p>}
            <p
              className={
                book.available_copies > 0 ? "badge available" : "badge unavailable"
              }
            >
              {book.available_copies > 0
                ? `${book.available_copies} available`
                : "Not available"}
            </p>

            {/* Only students can request — librarians/admins issue books
                directly via the Issue/Return Books page instead. */}
            {user?.role === "student" &&
              (pendingByBook[book.id] ? (
                <div className="mt-2">
                  <div className="w-full rounded-md bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-700">
                    Requested — waiting for approval
                  </div>
                  {/* Only exists while the request is pending. Once a librarian
                      approves (or rejects) it, this row disappears on next load
                      and the server refuses a late cancel anyway. */}
                  <button
                    disabled={cancellingId === book.id}
                    onClick={() => handleCancel(book.id)}
                    className="mt-1.5 w-full rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancellingId === book.id ? "Cancelling..." : "Cancel Request"}
                  </button>
                </div>
              ) : (
                <button
                  disabled={book.available_copies < 1 || requestingId === book.id}
                  onClick={() => handleRequest(book.id)}
                  className="mt-2 w-full rounded-md bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {requestingId === book.id ? "Requesting..." : "Request to Borrow"}
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
