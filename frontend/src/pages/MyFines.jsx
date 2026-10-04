import { useEffect, useState } from "react";
import api from "../api/client";
import { formatDate } from "../utils/formatDate";

// NOTE: no Figma design exists for this page yet — plain functional layout.
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

  const settledFines = loans.filter((l) => l.is_returned && Number(l.fine_amount) > 0);
  const unpaidSettled = settledFines.filter((l) => !l.fine_paid);
  const paidSettled = settledFines.filter((l) => l.fine_paid);
  const activeOverdue = loans.filter((l) => !l.is_returned && Number(l.current_fine) > 0);

  const totalUnpaid = unpaidSettled.reduce((sum, l) => sum + Number(l.fine_amount), 0);
  const totalOwedNow = activeOverdue.reduce((sum, l) => sum + Number(l.current_fine), 0);
  // What's ACTUALLY owed right now — paid fines don't count toward this,
  // even though they're still part of the loan's history below.
  const grandTotal = totalUnpaid + totalOwedNow;

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">My Fines</h1>
      <p className="mt-1 text-sm text-gray-500">
        What you currently owe, plus your fine history from returned books.
      </p>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-gray-500">Total owed right now</p>
        <p className={`mt-1 text-2xl font-bold ${grandTotal > 0 ? "text-amber-600" : "text-gray-900"}`}>
          {grandTotal.toFixed(2)} BDT
        </p>
        {totalOwedNow > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            Includes {totalOwedNow.toFixed(2)} BDT still accruing on overdue books you haven't returned yet
          </p>
        )}
        {totalUnpaid > 0 && (
          <p className="mt-1 text-xs text-red-600">
            {totalUnpaid.toFixed(2)} BDT is a finalized fine waiting to be paid at the desk
          </p>
        )}
      </div>

      {activeOverdue.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">Overdue right now — return to stop the fine growing</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4 font-medium">Book</th>
                <th className="pb-2 pr-4 font-medium">Due</th>
                <th className="pb-2 font-medium">Owed so far</th>
              </tr>
            </thead>
            <tbody>
              {activeOverdue.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                  <td className="py-3 pr-4 text-red-600">{formatDate(l.due_date)}</td>
                  <td className="py-3 font-medium text-amber-600">{l.current_fine} BDT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unpaidSettled.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-base font-bold text-red-800">Unpaid — please settle at the circulation desk</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-red-200 text-xs uppercase tracking-wide text-red-700">
                <th className="pb-2 pr-4 font-medium">Book</th>
                <th className="pb-2 pr-4 font-medium">Returned</th>
                <th className="pb-2 font-medium">Fine</th>
              </tr>
            </thead>
            <tbody>
              {unpaidSettled.map((l) => (
                <tr key={l.id} className="border-b border-red-100">
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                  <td className="py-3 pr-4 text-gray-600">{formatDate(l.return_date)}</td>
                  <td className="py-3 font-medium text-red-700">{l.fine_amount} BDT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900">Fine history</h2>
        {settledFines.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No fines charged yet.</p>
        ) : (
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
              {settledFines.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                  <td className="py-3 pr-4 text-gray-600">{formatDate(l.return_date)}</td>
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.fine_amount} BDT</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      l.fine_paid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}>
                      {l.fine_paid ? "Paid" : "Unpaid"}
                    </span>
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
