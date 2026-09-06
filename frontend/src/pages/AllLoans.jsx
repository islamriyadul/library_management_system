import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout.
export default function AllLoans() {
  const [loans, setLoans] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api.get("/loans/all/").then((res) => {
      setLoans(res.data);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <h1 className="text-2xl font-bold text-gray-900">All Loans</h1>
      <p className="mt-1 text-sm text-gray-500">Every loan in the system, active and returned.</p>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        {status === "loading" && <p className="text-sm text-gray-500">Loading...</p>}
        {status === "error" && <p className="text-sm text-red-600">Couldn't load loans.</p>}
        {status === "ready" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4 font-medium">Book</th>
                <th className="pb-2 pr-4 font-medium">Student</th>
                <th className="pb-2 pr-4 font-medium">Issued</th>
                <th className="pb-2 pr-4 font-medium">Due</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Fine</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const overdue = !l.is_returned && new Date(l.due_date) < new Date();
                return (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{l.book_title}</td>
                    <td className="py-3 pr-4 text-gray-600">{l.username}</td>
                    <td className="py-3 pr-4 text-gray-600">{l.issue_date}</td>
                    <td className={`py-3 pr-4 ${overdue ? "font-medium text-red-600" : "text-gray-600"}`}>{l.due_date}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        l.is_returned ? "bg-gray-100 text-gray-500" : overdue ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                      }`}>
                        {l.is_returned ? "Returned" : overdue ? "Overdue" : "Active"}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">{l.fine_amount} BDT</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
