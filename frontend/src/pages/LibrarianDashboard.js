import { useEffect, useState } from "react";
import api from "../api/client";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export default function LibrarianDashboard() {
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Add book form
  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    isbn: "",
    subject: "",
    total_copies: 1,
  });

  // Issue book form
  const [issueForm, setIssueForm] = useState({ book_id: "", username: "" });

  const loadData = async () => {
    try {
      const [booksRes, loansRes] = await Promise.all([
        api.get("/books/"),
        api.get("/loans/all/?status=active"),
      ]);
      setBooks(booksRes.data);
      setLoans(loansRes.data);
    } catch (err) {
      setError("Could not load dashboard data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setMessage("");
    } else {
      setMessage(msg);
      setError("");
    }
    setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    try {
      await api.post("/books/", newBook);
      setNewBook({ title: "", author: "", isbn: "", subject: "", total_copies: 1 });
      showMessage("Book added successfully.");
      loadData();
    } catch (err) {
      const detail = err.response?.data?.isbn?.[0] || "Could not add book.";
      showMessage(detail, true);
    }
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    try {
      await api.post("/loans/issue/", {
        book_id: issueForm.book_id,
        username: issueForm.username,
      });
      setIssueForm({ book_id: "", username: "" });
      showMessage("Book issued successfully.");
      loadData();
    } catch (err) {
      const detail = err.response?.data?.detail || "Could not issue book.";
      showMessage(detail, true);
    }
  };

  const handleReturn = async (loanId) => {
    try {
      const res = await api.post(`/loans/${loanId}/return/`);
      const fine = res.data.fine_amount;
      showMessage(
        fine > 0
          ? `Book returned. Fine charged: ${fine} Tk.`
          : "Book returned. No fine."
      );
      loadData();
    } catch (err) {
      showMessage("Could not process return.", true);
    }
  };

  return (
    <div className="page">
      <h2>Librarian Dashboard</h2>
      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="dashboard-grid">
        <section className="panel">
          <h3>Add a Book</h3>
          <form onSubmit={handleAddBook} className="stacked-form">
            <input
              placeholder="Title"
              value={newBook.title}
              onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
              required
            />
            <input
              placeholder="Author"
              value={newBook.author}
              onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
              required
            />
            <input
              placeholder="ISBN"
              value={newBook.isbn}
              onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
              required
            />
            <input
              placeholder="Subject (optional)"
              value={newBook.subject}
              onChange={(e) => setNewBook({ ...newBook, subject: e.target.value })}
            />
            <input
              type="number"
              min={1}
              placeholder="Total copies"
              value={newBook.total_copies}
              onChange={(e) =>
                setNewBook({ ...newBook, total_copies: Number(e.target.value) })
              }
              required
            />
            <button type="submit">Add Book</button>
          </form>
        </section>

        <section className="panel">
          <h3>Issue a Book</h3>
          <form onSubmit={handleIssue} className="stacked-form">
            <select
              value={issueForm.book_id}
              onChange={(e) =>
                setIssueForm({ ...issueForm, book_id: e.target.value })
              }
              required
            >
              <option value="">Select a book...</option>
              {books
                .filter((b) => b.available_copies > 0)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.available_copies} available)
                  </option>
                ))}
            </select>
            <input
              placeholder="Student username"
              value={issueForm.username}
              onChange={(e) =>
                setIssueForm({ ...issueForm, username: e.target.value })
              }
              required
            />
            <button type="submit">Issue Book</button>
          </form>
        </section>
      </div>

      <section className="panel">
        <h3>Active Loans</h3>
        {loans.length === 0 && <p>No active loans right now.</p>}
        <table className="loan-table">
          <thead>
            <tr>
              <th>Book</th>
              <th>Student</th>
              <th>Issued</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td>{loan.book_title}</td>
                <td>{loan.username}</td>
                <td>{formatDate(loan.issue_date)}</td>
                <td>{formatDate(loan.due_date)}</td>
                <td>
                  <button onClick={() => handleReturn(loan.id)}>
                    Mark Returned
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>All Books</h3>
        <table className="loan-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>ISBN</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id}>
                <td>{b.title}</td>
                <td>{b.author}</td>
                <td>{b.isbn}</td>
                <td>
                  {b.available_copies} / {b.total_copies}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
