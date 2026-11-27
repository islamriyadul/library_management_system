import { useEffect, useState } from "react";
import api from "../api/client";
import { formatDate } from "../utils/formatDate";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function CardApplications() {
  const [tab, setTab] = useState("pending");
  const [apps, setApps] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");

  const load = (which = tab) => {
    setLoadState("loading");
    api
      .get("/library-card/applications/", { params: { status: which } })
      .then((res) => {
        setApps(res.data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  };

  useEffect(() => {
    load(tab);
    setRejectingId(null);
  }, [tab]);

  const review = async (id, action) => {
    setBusyId(id);
    setMessage("");
    try {
      await api.post(`/library-card/applications/${id}/review/`, { action, reason });
      setRejectingId(null);
      setReason("");
      load();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not save your decision.");
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Library Card Applications</h1>
      <p className="mt-1 text-sm text-gray-500">
        Check each student’s details and photo, then approve or reject. After approval the student pays the card fee
        online and their card is issued automatically.
      </p>

      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.key ? "bg-blue-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      <div className="mt-5 space-y-4">
        {loadState === "loading" && <p className="text-sm text-gray-500">Loading...</p>}
        {loadState === "error" && <p className="text-sm text-red-600">Couldn’t load applications.</p>}
        {loadState === "ready" && apps.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-400 shadow-sm">
            No {tab} applications.
          </div>
        )}

        {loadState === "ready" &&
          apps.map((a) => (
            <div key={a.id} className="flex gap-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <a href={a.photo} target="_blank" rel="noreferrer" className="shrink-0" title="Open full size">
                <img src={a.photo} alt={a.full_name} className="aspect-[7/9] w-28 rounded-lg border border-gray-200 object-cover" />
              </a>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className="text-base font-bold text-gray-900">{a.full_name}</h2>
                  <span className="text-xs text-gray-400">@{a.username}</span>
                </div>
                <dl className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="inline text-gray-400">Student ID: </dt><dd className="inline font-medium text-gray-900">{a.student_id}</dd></div>
                  <div><dt className="inline text-gray-400">Session: </dt><dd className="inline font-medium text-gray-900">{a.session}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline text-gray-400">Department: </dt><dd className="inline font-medium text-gray-900">{a.department}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline text-gray-400">Address: </dt><dd className="inline font-medium text-gray-900">{a.address}</dd></div>
                  <div><dt className="inline text-gray-400">Submitted: </dt><dd className="inline text-gray-700">{formatDate(a.submitted_at)}</dd></div>
                  {a.card_number && (
                    <div><dt className="inline text-gray-400">Card no.: </dt><dd className="inline font-medium text-gray-900">{a.card_number}</dd></div>
                  )}
                </dl>

                {a.status === "rejected" && (
                  <p className="mt-2 text-sm text-red-600">Rejected: {a.rejection_reason}</p>
                )}
                {a.status === "approved" && (
                  <p className="mt-2 text-sm text-green-700">
                    {a.issued_at ? `Card issued ${formatDate(a.issued_at)}` : "Approved — waiting for the student to pay the card fee."}
                  </p>
                )}

                {a.status === "pending" && (
                  <div className="mt-4">
                    {rejectingId === a.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          maxLength={255}
                          rows={2}
                          placeholder="Tell the student what to fix (e.g. photo is blurry, wrong student ID)"
                          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === a.id || !reason.trim()}
                            onClick={() => review(a.id, "reject")}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm rejection
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setReason(""); }}
                            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === a.id}
                          onClick={() => review(a.id, "approve")}
                          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                        >
                          {busyId === a.id ? "Saving..." : "Approve"}
                        </button>
                        <button
                          onClick={() => { setRejectingId(a.id); setReason(""); }}
                          className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
