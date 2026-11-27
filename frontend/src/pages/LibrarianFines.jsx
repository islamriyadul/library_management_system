import { useEffect, useState } from "react";
import api from "../api/client";
import { formatDate } from "../utils/formatDate";

// NOTE: no Figma design exists for this page yet — plain functional layout.
//
// Three genuinely different numbers, shown separately on purpose. Students can
// pay at the desk OR online (bKash / Nagad), and can pay a fine while the book
// is still out, so "paid" is tracked per loan as fine_paid_amount:
// - "Collected" = all money received so far (fine_paid_amount, desk + online).
// - "Outstanding (unpaid)" = what is still owed on RETURNED loans
//   (outstanding_fine = final fine - paid so far).
// - "Still accruing" = what is still owed on books that are overdue and not
//   back yet (outstanding_fine; it grows every day until they are returned).
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

  const owed = (l) => Number(l.outstanding_fine || 0);
  const paid = (l) => Number(l.fine_paid_amount || 0);
  const totalCollected = loans.reduce((sum, l) => sum + paid(l), 0);
  const totalOutstanding = unpaidFines.reduce((sum, l) => sum + owed(l), 0);
  const totalCurrentlyOwed = activeOverdue.reduce((sum, l) => sum + owed(l), 0);

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
              <p className="mt-1 text-xs text-gray-400">Received so far (desk + online)</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Outstanding (unpaid)</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{totalOutstanding.toFixed(2)} BDT</p>
              <p className="mt-1 text-xs text-gray-400">Returned, fine finalized, not yet collected</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Still accruing</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{totalCurrentlyOwed.toFixed(2)} BDT</p>
              <p className="mt-1 text-xs text-gray-400">Books not back yet — students can pay this online</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Active overdue loans</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{activeOverdue.length}</p>
            </div>
          </div>

          {activeOverdue.length > 0 && (
            <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Currently overdue — fine still accruing</h2>
              <p className="mt-1 text-xs text-gray-400">Students can pay what they owe online. The fine keeps growing until the book is returned, and anything already paid is credited.</p>
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Book</th>
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Due</th>
                    <th className="pb-2 pr-4 font-medium">Fine so far</th>
                    <th className="pb-2 pr-4 font-medium">Paid</th>
                    <th className="pb-2 font-medium">Owed now</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOverdue.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                      <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                      <td className="py-3 pr-4 text-red-600">{formatDate(l.due_date)}</td>
                      <td className="py-3 pr-4 text-gray-700">{l.current_fine} BDT</td>
                      <td className="py-3 pr-4 text-green-700">{paid(l) > 0 ? `${paid(l)} BDT` : "—"}</td>
                      <td className="py-3 font-medium text-amber-600">{owed(l)} BDT</td>
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
                    <th className="pb-2 pr-4 font-medium">Paid online</th>
                    <th className="pb-2 pr-4 font-medium">Owed</th>
                    <th className="pb-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidFines.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                      <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(l.return_date)}</td>
                      <td className="py-3 pr-4 text-gray-700">{l.fine_amount} BDT</td>
                      <td className="py-3 pr-4 text-green-700">{paid(l) > 0 ? `${paid(l)} BDT` : "—"}</td>
                      <td className="py-3 pr-4 font-medium text-red-600">{owed(l)} BDT</td>
                      <td className="py-3 text-right">
                        <button
                          disabled={payingId === l.id}
                          onClick={() => handleMarkPaid(l.id)}
                          className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                        >
                          {payingId === l.id ? "Marking..." : `Collect ${owed(l)} BDT`}
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
                      <td className="py-3 text-gray-600">{l.fine_paid_by_username || "Online"}</td>
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
