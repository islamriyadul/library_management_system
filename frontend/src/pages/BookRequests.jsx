import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout.
export default function BookRequests() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  // Per-request chosen loan length — librarian sets this at approval time,
  // since the student never picks a duration when requesting.
  const [daysByRequest, setDaysByRequest] = useState({});

  const daysFor = (id) => daysByRequest[id] ?? 14;

  const load = () => {
    api.get("/book-requests/pending/").then((res) => {
      setRequests(res.data);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  };

  useEffect(load, []);

  const handleResolve = async (id, action) => {
    setBusyId(id);
    setMessage("");
    try {
      // "days" only makes sense for approval — the backend validates it even
      // on reject, so it must never be sent there.
      const payload = action === "approve" ? { action, days: daysFor(id) } : { action };
      await api.post(`/book-requests/${id}/resolve/`, payload);
      load();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not resolve this request.");
      // e.g. the student cancelled while this page was open — refresh so the
      // stale row disappears instead of sitting there.
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Book Requests</h1>
      <p className="mt-1 text-sm text-gray-500">
        Students requesting to borrow a book from the Catalog. Set the loan length and approve to issue it immediately, or reject the request.
      </p>

      {message && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        {status === "loading" && <p className="text-sm text-gray-500">Loading...</p>}
        {status === "error" && <p className="text-sm text-red-600">Couldn't load requests.</p>}
        {status === "ready" && requests.length === 0 && (
          <p className="text-sm text-gray-400">No pending requests right now.</p>
        )}
        {status === "ready" && requests.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4 font-medium">Student</th>
                <th className="pb-2 pr-4 font-medium">Book</th>
                <th className="pb-2 pr-4 font-medium">Requested</th>
                <th className="pb-2 pr-4 font-medium">Loan Days</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{r.student_username}</td>
                  <td className="py-3 pr-4 text-gray-600">{r.book_title}</td>
                  <td className="py-3 pr-4 text-gray-400">{new Date(r.requested_at).toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={daysFor(r.id)}
                      onChange={(e) =>
                        setDaysByRequest({ ...daysByRequest, [r.id]: e.target.value })
                      }
                      className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        disabled={busyId === r.id}
                        onClick={() => handleResolve(r.id, "approve")}
                        className="text-sm font-medium text-green-700 hover:underline disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => handleResolve(r.id, "reject")}
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
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
