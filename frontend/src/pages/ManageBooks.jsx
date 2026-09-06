import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout.
export default function ManageBooks() {
  const [books, setBooks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState({ title: "", author: "", isbn: "", subject: "", total_copies: 1 });
  const [error, setError] = useState("");

  const load = () => {
    api.get("/books/").then((res) => {
      setBooks(res.data);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  };

  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/books/", form);
      setForm({ title: "", author: "", isbn: "", subject: "", total_copies: 1 });
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Could not add book."));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this book?")) return;
    await api.delete(`/books/${id}/`);
    load();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <h1 className="text-2xl font-bold text-gray-900">Add / Manage Books</h1>
      <p className="mt-1 text-sm text-gray-500">Add new titles or remove existing ones from the catalog.</p>

      <form onSubmit={handleAdd} className="mt-6 grid max-w-2xl grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        {error && <p className="col-span-2 rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>}
        <input required placeholder="Title" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="col-span-2 rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <input required placeholder="Author" value={form.author}
          onChange={(e) => setForm({ ...form, author: e.target.value })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <input required placeholder="ISBN" value={form.isbn}
          onChange={(e) => setForm({ ...form, isbn: e.target.value })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <input placeholder="Subject" value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <input required type="number" min="1" placeholder="Total Copies" value={form.total_copies}
          onChange={(e) => setForm({ ...form, total_copies: Number(e.target.value) })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <button className="col-span-2 mt-2 rounded-md bg-blue-900 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          Add Book
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900">Catalog</h2>
        {status === "loading" && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
        {status === "error" && <p className="mt-2 text-sm text-red-600">Couldn't load books.</p>}
        {status === "ready" && (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Author</th>
                <th className="pb-2 pr-4 font-medium">Available</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{b.title}</td>
                  <td className="py-3 pr-4 text-gray-600">{b.author}</td>
                  <td className="py-3 pr-4 text-gray-600">{b.available_copies} / {b.total_copies}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => handleDelete(b.id)} className="text-sm font-medium text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
