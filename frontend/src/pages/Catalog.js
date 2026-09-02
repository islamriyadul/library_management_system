import { useEffect, useState } from "react";
import api from "../api/client";

export default function Catalog() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

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
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBooks(search);
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

      {!loading && books.length === 0 && <p>No books found.</p>}

      <div className="book-grid">
        {books.map((book) => (
          <div className="book-card" key={book.id}>
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
          </div>
        ))}
      </div>
    </div>
  );
}
