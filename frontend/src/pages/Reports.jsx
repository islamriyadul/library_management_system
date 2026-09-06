import { useEffect, useState } from "react";
import api from "../api/client";

// NOTE: no Figma design exists for this page yet — plain functional layout.
// These are simple aggregates computed from your existing data (no new
// backend endpoints needed) — not a full analytics/reporting system.
export default function Reports() {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/books/"), api.get("/loans/all/"), api.get("/staff/")])
      .then(([books, loans, staff]) => {
        const activeLoans = loans.data.filter((l) => !l.is_returned);
        const overdue = activeLoans.filter((l) => new Date(l.due_date) < new Date());
        const totalCopies = books.data.reduce((sum, b) => sum + b.total_copies, 0);
        const availableCopies = books.data.reduce((sum, b) => sum + b.available_copies, 0);
        const totalFinesCollected = loans.data
          .filter((l) => l.is_returned)
          .reduce((sum, l) => sum + Number(l.fine_amount), 0);

        setData({
          totalTitles: books.data.length,
          totalCopies,
          availableCopies,
          totalLoans: loans.data.length,
          activeLoans: activeLoans.length,
          overdueLoans: overdue.length,
          totalStaff: staff.data.length,
          totalFinesCollected,
        });
      })
      .catch(() => setData(false));
  }, []);

  if (data === null) return <div className="p-8 text-sm text-gray-500">Loading reports...</div>;
  if (data === false) return <div className="p-8 text-sm text-red-600">Couldn't load report data.</div>;

  const cards = [
    { label: "Book Titles", value: data.totalTitles },
    { label: "Total Copies", value: data.totalCopies },
    { label: "Copies Available Now", value: data.availableCopies },
    { label: "Total Loans (all time)", value: data.totalLoans },
    { label: "Currently Active Loans", value: data.activeLoans },
    { label: "Currently Overdue", value: data.overdueLoans },
    { label: "Staff Accounts", value: data.totalStaff },
    { label: "Fines Collected (all time)", value: `${data.totalFinesCollected} BDT` },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <p className="mt-1 text-sm text-gray-500">
        Simple live totals from your current data — not a full analytics dashboard yet.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
