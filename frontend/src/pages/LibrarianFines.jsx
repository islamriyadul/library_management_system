import { useEffect, useState } from "react";
import api from "../api/client";
import { formatDate } from "../utils/formatDate";

// NOTE: no Figma design exists for this page yet — plain functional layout.
//
// Three genuinely different numbers, shown separately on purpose:
// - "Collected" = fine_amount on returned loans marked fine_paid=True —
//   money actually handed over and confirmed.
// - "Outstanding (unpaid)" = fine_amount on returned loans NOT yet marked
//   paid — finalized amount, just hasn't been collected yet.
// - "Currently owed, still accruing" = current_fine on loans still checked
//   out and overdue — a live number that isn't payable yet, since the book
//   hasn't come back and the final amount isn't locked in.
export default function LibrarianFines() {
  const [loans, setLoans] = useState([]);
  const [status, setStatus] = useState("loading");
  const [payingId, setPayingId] = useState(null);
  const [message, setMessage] = useState("");

  const load = () => {
    api.get("/loans/all/").then((res) => {
      setLoans(res.data);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  };

  useEffect(load, []);

  const handleMarkPaid = async (loanId) => {
    setPayingId(loanId);
    setMessage("");
    try {
      await api.post(`/loans/${loanId}/pay-fine/`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not mark this fine as paid.");
    } finally {
      setPayingId(null);
    }
  };

  const returnedWithFine = loans.filter((l) => l.is_returned && Number(l.fine_amount) > 0);
  const paidFines = returnedWithFine.filter((l) => l.fine_paid);
  const unpaidFines = returnedWithFine.filter((l) => !l.fine_paid);
  const activeOverdue = loans.filter((l) => !l.is_returned && Number(l.current_fine) > 0);

  const totalCollected = paidFines.reduce((sum, l) => sum + Number(l.fine_amount), 0);
  const totalOutstanding = unpaidFines.reduce((sum, l) => sum + Number(l.fine_amount), 0);
  const totalCurrentlyOwed = activeOverdue.reduce((sum, l) => sum + Number(l.current_fine), 0);

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Fines</h1>
      <p className="mt-1 text-sm text-gray-500">System-wide fine collection and currently overdue loans.</p>

      {message && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      {status === "ready" && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Collected</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{totalCollected.toFixed(2)} BDT</p>
              <p className="mt-1 text-xs text-gray-400">Confirmed paid</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Outstanding (unpaid)</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{totalOutstanding.toFixed(2)} BDT</p>
              <p className="mt-1 text-xs text-gray-400">Returned, fine finalized, not yet collected</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Still accruing</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{totalCurrentlyOwed.toFixed(2)} BDT</p>
              <p className="mt-1 text-xs text-gray-400">Books not back yet — not payable yet</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Active overdue loans</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{activeOverdue.length}</p>
            </div>
          </div>

          {activeOverdue.length > 0 && (
            <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Currently overdue — fine still accruing</h2>
              <p className="mt-1 text-xs text-gray-400">Not payable until the book is returned and the fine locks in.</p>
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Book</th>
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Due</th>
                    <th className="pb-2 font-medium">Owed so far</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOverdue.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                      <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                      <td className="py-3 pr-4 text-red-600">{formatDate(l.due_date)}</td>
                      <td className="py-3 font-medium text-amber-600">{l.current_fine} BDT</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">Unpaid fines — collect and mark paid</h2>
            {unpaidFines.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">Nothing outstanding — all finalized fines are collected.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Book</th>
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Returned</th>
                    <th className="pb-2 pr-4 font-medium">Fine</th>
                    <th className="pb-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidFines.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                      <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(l.return_date)}</td>
                      <td className="py-3 pr-4 font-medium text-red-600">{l.fine_amount} BDT</td>
                      <td className="py-3 text-right">
                        <button
                          disabled={payingId === l.id}
                          onClick={() => handleMarkPaid(l.id)}
                          className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                        >
                          {payingId === l.id ? "Marking..." : "Mark as Paid"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">Payment history</h2>
            {paidFines.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">No fines collected yet.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Book</th>
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Fine</th>
                    <th className="pb-2 pr-4 font-medium">Paid On</th>
                    <th className="pb-2 font-medium">Collected By</th>
                  </tr>
                </thead>
                <tbody>
                  {paidFines.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                      <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                      <td className="py-3 pr-4 font-medium text-green-700">{l.fine_amount} BDT</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(l.fine_paid_at)}</td>
                      <td className="py-3 text-gray-600">{l.fine_paid_by_username || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
