import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { formatDate } from "../utils/formatDate";

// What a student owes = fine so far - already paid (desk or online).
// `outstanding_fine` and `fine_paid_amount` come from the API, so this page,
// the dashboard and the Payments page always agree.
export default function MyFines() {
  const [loans, setLoans] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    api
      .get("/loans/mine/")
      .then((res) => {
        setLoans(res.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") {
    return <div className="p-8 text-sm text-gray-500">Loading fines...</div>;
  }
  if (status === "error") {
    return <div className="p-8 text-sm text-red-600">Couldn't load your fines. Try refreshing.</div>;
  }

  const owed = (l) => Number(l.outstanding_fine || 0);
  const paid = (l) => Number(l.fine_paid_amount || 0);

  // Books still out and overdue (their fine keeps growing every day).
  const activeOverdue = loans.filter((l) => !l.is_returned && Number(l.current_fine) > 0);
  // Returned books that carried a fine.
  const returnedFines = loans.filter((l) => l.is_returned && Number(l.fine_amount) > 0);
  const returnedUnpaid = returnedFines.filter((l) => owed(l) > 0);

  const totalOwedNow = loans.reduce((sum, l) => sum + owed(l), 0);
  const growingNow = activeOverdue.reduce((sum, l) => sum + owed(l), 0);
  const settledUnpaid = returnedUnpaid.reduce((sum, l) => sum + owed(l), 0);
  const totalPaid = loans.reduce((sum, l) => sum + paid(l), 0);

  const statusOf = (l) => {
    if (l.fine_paid) return { text: "Paid", cls: "bg-green-50 text-green-700" };
    if (paid(l) > 0) return { text: "Part paid", cls: "bg-amber-50 text-amber-700" };
    return { text: "Unpaid", cls: "bg-red-50 text-red-600" };
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">My Fines</h1>
      <p className="mt-1 text-sm text-gray-500">
        What you currently owe, plus your fine history. You can pay online with bKash or Nagad.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-500">Total owed right now</p>
          <p className={`mt-1 text-2xl font-bold ${totalOwedNow > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {totalOwedNow.toFixed(2)} BDT
          </p>
          {growingNow > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Includes {growingNow.toFixed(2)} BDT on overdue books you haven't returned yet. It grows every day until
              you return them.
            </p>
          )}
          {settledUnpaid > 0 && (
            <p className="mt-1 text-xs text-red-600">
              {settledUnpaid.toFixed(2)} BDT is a finalized fine from a returned book.
            </p>
          )}
          {totalPaid > 0 && (
            <p className="mt-1 text-xs text-green-700">{totalPaid.toFixed(2)} BDT already paid.</p>
          )}
        </div>
        {totalOwedNow > 0 && (
          <Link
            to="/payments"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Pay online
          </Link>
        )}
      </div>

      {activeOverdue.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">Overdue right now — return to stop the fine growing</h2>
          <div className="overflow-x-auto">
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Book</th>
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
                    <td className="py-3 pr-4 text-red-600">{formatDate(l.due_date)}</td>
                    <td className="py-3 pr-4 text-gray-700">{l.current_fine} BDT</td>
                    <td className="py-3 pr-4 text-green-700">{paid(l) > 0 ? `${paid(l)} BDT` : "—"}</td>
                    <td className="py-3 font-medium">
                      {owed(l) > 0 ? (
                        <span className="text-amber-600">{owed(l)} BDT</span>
                      ) : (
                        <span className="text-green-700">Paid up</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {returnedUnpaid.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-base font-bold text-red-800">Unpaid — pay online or at the circulation desk</h2>
          <div className="overflow-x-auto">
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-red-200 text-xs uppercase tracking-wide text-red-700">
                  <th className="pb-2 pr-4 font-medium">Book</th>
                  <th className="pb-2 pr-4 font-medium">Returned</th>
                  <th className="pb-2 pr-4 font-medium">Fine</th>
                  <th className="pb-2 pr-4 font-medium">Paid</th>
                  <th className="pb-2 font-medium">Owed</th>
                </tr>
              </thead>
              <tbody>
                {returnedUnpaid.map((l) => (
                  <tr key={l.id} className="border-b border-red-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                    <td className="py-3 pr-4 text-gray-600">{formatDate(l.return_date)}</td>
                    <td className="py-3 pr-4 text-gray-700">{l.fine_amount} BDT</td>
                    <td className="py-3 pr-4 text-green-700">{paid(l) > 0 ? `${paid(l)} BDT` : "—"}</td>
                    <td className="py-3 font-medium text-red-700">{owed(l)} BDT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900">Fine history</h2>
        {returnedFines.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No fines on returned books yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Book</th>
                  <th className="pb-2 pr-4 font-medium">Returned</th>
                  <th className="pb-2 pr-4 font-medium">Fine</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {returnedFines.map((l) => {
                  const st = statusOf(l);
                  return (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                      <td className="py-3 pr-4 text-gray-600">{formatDate(l.return_date)}</td>
                      <td className="py-3 pr-4 font-medium text-gray-900">{l.fine_amount} BDT</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
