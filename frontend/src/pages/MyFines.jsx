import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout
// for now. Restyle once the My Fines frame is designed.
//
// IMPORTANT BACKEND LIMITATION: fine_amount is only calculated once a loan
// is actually returned (see Loan.mark_returned() in the backend). For a
// book that's still checked out and overdue, there is currently no live
// "fine so far" number from the API — so this page can only show:
//   1) fines already locked in from returned loans, and
//   2) a flag on still-active loans that are overdue (no live amount yet)
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

  const today = new Date();
  const settledFines = loans.filter((l) => l.is_returned && Number(l.fine_amount) > 0);
  const activeOverdue = loans.filter((l) => !l.is_returned && new Date(l.due_date) < today);
  const totalSettled = settledFines.reduce((sum, l) => sum + Number(l.fine_amount), 0);

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <h1 className="text-2xl font-bold text-gray-900">My Fines</h1>
      <p className="mt-1 text-sm text-gray-500">
        Fines already charged, plus any active loans currently overdue.
      </p>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-gray-500">Total fines charged so far</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{totalSettled.toFixed(2)} BDT</p>
      </div>

      {activeOverdue.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You have {activeOverdue.length} book{activeOverdue.length > 1 ? "s" : ""} currently
          overdue. The fine amount is calculated once the book is returned.
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
                <th className="pb-2 font-medium">Fine</th>
              </tr>
            </thead>
            <tbody>
              {settledFines.map((l) => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                  <td className="py-3 pr-4 text-gray-600">{l.return_date}</td>
                  <td className="py-3 font-medium text-red-600">{l.fine_amount} BDT</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
