import { useEffect, useState } from "react";
import api from "../api/client";
import { formatDate } from "../utils/formatDate";

// NOTE: no Figma design exists for this page yet — plain functional layout.
export default function IssueReturnBooks() {
  const [activeLoans, setActiveLoans] = useState([]);
  const [books, setBooks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState({ username: "", book_id: "", days: 14 });
  const [message, setMessage] = useState("");

  const load = () => {
    api.get("/loans/all/").then((res) => {
      setActiveLoans(res.data.filter((l) => !l.is_returned));
      setStatus("ready");
    }).catch(() => setStatus("error"));
    api.get("/books/").then((res) => setBooks(res.data)).catch(() => setBooks([]));
  };

  useEffect(load, []);

  const handleIssue = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      await api.post("/loans/issue/", form);
      setMessage(`Book issued successfully — due in ${form.days} day${form.days == 1 ? "" : "s"}.`);
      setForm({ username: "", book_id: "", days: 14 });
      load();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not issue book.");
    }
  };

  const handleReturn = async (loanId) => {
    try {
      await api.post(`/loans/${loanId}/return/`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not process return.");
    }
  };

  const availableBooks = books.filter((b) => b.available_copies > 0);

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Issue / Return Books</h1>
      <p className="mt-1 text-sm text-gray-500">Issue a book to a student, or process a return.</p>

      {message && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

      <form onSubmit={handleIssue} className="mt-6 flex max-w-xl flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500">Student username</label>
          <input required value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            placeholder="e.g. sajjad_hossain" />
          {/* NOTE: there's no backend endpoint listing student accounts yet
              (the /staff/ endpoint only returns Librarian/Admin), so this
              stays a plain text field rather than a dropdown for now. */}
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500">Book</label>
          <select
            required
            value={form.book_id}
            onChange={(e) => setForm({ ...form, book_id: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="" disabled>Select a book...</option>
            {availableBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} — {b.available_copies} available
              </option>
            ))}
          </select>
          {availableBooks.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">No books currently have copies available.</p>
          )}
        </div>
        <div className="w-28">
          <label className="text-xs font-medium text-gray-500">Loan length (days)</label>
          <input
            required
            type="number"
            min={1}
            max={90}
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          Issue Book
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900">Active loans — process return</h2>
        {status === "loading" && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
        {status === "ready" && activeLoans.length === 0 && (
          <p className="mt-2 text-sm text-gray-400">No active loans right now.</p>
        )}
        {status === "ready" && activeLoans.length > 0 && (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4 font-medium">Book</th>
                <th className="pb-2 pr-4 font-medium">Student</th>
                <th className="pb-2 pr-4 font-medium">Due</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeLoans.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                  <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                  <td className="py-3 pr-4 text-gray-600">{formatDate(l.due_date)}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => handleReturn(l.id)} className="text-sm font-medium text-blue-700 hover:underline">
                      Mark Returned
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
