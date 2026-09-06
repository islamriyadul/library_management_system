import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout.
// Same backend limitation as the student My Fines page: fine_amount is only
// set once a loan is actually returned, so active overdue loans can't show
// a live number yet.
export default function LibrarianFines() {
  const [loans, setLoans] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api.get("/loans/all/").then((res) => {
      setLoans(res.data);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  }, []);

  const settledFines = loans.filter((l) => l.is_returned && Number(l.fine_amount) > 0);
  const activeOverdue = loans.filter((l) => !l.is_returned && new Date(l.due_date) < new Date());
  const totalCollected = settledFines.reduce((sum, l) => sum + Number(l.fine_amount), 0);

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <h1 className="text-2xl font-bold text-gray-900">Fines</h1>
      <p className="mt-1 text-sm text-gray-500">System-wide fine history and currently overdue loans.</p>

      {status === "ready" && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total fines collected</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{totalCollected.toFixed(2)} BDT</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Active overdue loans</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{activeOverdue.length}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">Fine history</h2>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Book</th>
                  <th className="pb-2 pr-4 font-medium">Student</th>
                  <th className="pb-2 pr-4 font-medium">Returned</th>
                  <th className="pb-2 font-medium">Fine</th>
                </tr>
              </thead>
              <tbody>
                {settledFines.map((l) => (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                    <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                    <td className="py-3 pr-4 text-gray-600">{l.return_date}</td>
                    <td className="py-3 font-medium text-red-600">{l.fine_amount} BDT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
