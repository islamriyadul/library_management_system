import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout.
export default function ManageStaff() {
  const [staff, setStaff] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "librarian" });
  const [error, setError] = useState("");

  const load = () => {
    api.get("/staff/").then((res) => {
      setStaff(res.data);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/staff/", form);
      setForm({ username: "", email: "", password: "", role: "librarian" });
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Could not create account."));
    }
  };

  const handleToggle = async (id) => {
    await api.post(`/staff/${id}/toggle-active/`);
    load();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <h1 className="text-2xl font-bold text-gray-900">Manage Staff</h1>
      <p className="mt-1 text-sm text-gray-500">Create Librarian or Admin accounts, or suspend existing ones.</p>

      <form onSubmit={handleCreate} className="mt-6 grid max-w-xl grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        {error && <p className="col-span-2 rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>}
        <input required placeholder="Username" value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <input required type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <input required type="password" placeholder="Password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <option value="librarian">Librarian</option>
          <option value="admin">Admin</option>
        </select>
        <button className="col-span-2 mt-2 rounded-md bg-blue-900 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          Create Account
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900">All staff accounts</h2>
        {status === "loading" && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
        {status === "ready" && (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4 font-medium">Username</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{s.username}</td>
                  <td className="py-3 pr-4 text-gray-600">{s.email}</td>
                  <td className="py-3 pr-4 capitalize text-gray-600">{s.role}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.is_active_account ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                      {s.is_active_account ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => handleToggle(s.id)} className="text-sm font-medium text-blue-700 hover:underline">
                      {s.is_active_account ? "Suspend" : "Reactivate"}
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
