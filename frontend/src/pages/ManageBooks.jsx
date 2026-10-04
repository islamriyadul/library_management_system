import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout.
export default function ManageBooks() {
  const [books, setBooks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState({ title: "", author: "", isbn: "", subject: "", total_copies: 1 });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.get("/books/").then((res) => {
      setBooks(res.data);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  };

  useEffect(load, []);

  const [dragActive, setDragActive] = useState(false);

  // Shared by both the click-to-browse input AND drag-and-drop — one
  // source of truth so neither path can get out of sync with the other.
  const setCoverFromFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    setError("");
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e) => {
    setCoverFromFile(e.target.files?.[0] || null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    setCoverFromFile(e.dataTransfer.files?.[0] || null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Build multipart form data so the cover image can ride along with
      // the rest of the fields in one request.
      const payload = new FormData();
      payload.append("title", form.title);
      payload.append("author", form.author);
      payload.append("isbn", form.isbn);
      payload.append("subject", form.subject);
      payload.append("total_copies", form.total_copies);
      if (coverFile) payload.append("cover_image", coverFile);

      await api.post("/books/", payload);

      setForm({ title: "", author: "", isbn: "", subject: "", total_copies: 1 });
      setCoverFile(null);
      setCoverPreview(null);
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Could not add book."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this book?")) return;
    await api.delete(`/books/${id}/`);
    load();
  };

  return (
    <>
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

        {/* Cover photo upload — click-to-browse (original) AND drag-and-drop
            from the OS file explorer both work, feeding the same handler. */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500">Cover photo (optional)</label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`mt-1 flex items-center gap-4 rounded-md border-2 border-dashed p-4 transition-colors ${
              dragActive ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white">
              {coverPreview ? (
                <img src={coverPreview} alt="Cover preview" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] text-gray-400">No cover</span>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {dragActive ? "Drop the image here..." : "Drag and drop an image here, or"}
              </p>
              <input type="file" accept="image/*" onChange={handleCoverChange}
                className="mt-1 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
            </div>
          </div>
        </div>

        <button disabled={submitting} className="col-span-2 mt-2 rounded-md bg-blue-900 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
          {submitting ? "Adding..." : "Add Book"}
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
                <th className="pb-2 pr-4 font-medium">Cover</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Author</th>
                <th className="pb-2 pr-4 font-medium">Available</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4">
                    <div className="flex h-14 w-11 items-center justify-center overflow-hidden rounded bg-gray-100">
                      {b.cover_image ? (
                        <img src={b.cover_image} alt={b.title} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-[9px] text-gray-400">No cover</span>
                      )}
                    </div>
                  </td>
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
    </>
  );
}
