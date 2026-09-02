import { useEffect, useState } from "react";
import api from "../api/client";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export default function MyLoans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    api
      .get("/loans/mine/")
      .then((res) => setLoans(res.data))
      .catch(() => setErrorMsg("Could not load your loans."))
      .finally(() => setLoading(false));
  }, []);

  const activeLoans = loans.filter((l) => !l.is_returned);
  const pastLoans = loans.filter((l) => l.is_returned);
  const totalFines = loans.reduce((sum, l) => sum + (l.fine_amount || 0), 0);

  return (
    <div className="page">
      <h2>My Loans</h2>
      {loading && <p>Loading...</p>}
      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {!loading && (
        <>
          <div className="summary-bar">
            <span>Active loans: {activeLoans.length}</span>
            <span>Total fines: {totalFines} Tk</span>
          </div>

          <h3>Current</h3>
          {activeLoans.length === 0 && <p>No active loans.</p>}
          <table className="loan-table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {activeLoans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.book_title}</td>
                  <td>{formatDate(loan.issue_date)}</td>
                  <td>{formatDate(loan.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>History</h3>
          {pastLoans.length === 0 && <p>No past loans yet.</p>}
          <table className="loan-table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Returned</th>
                <th>Fine</th>
              </tr>
            </thead>
            <tbody>
              {pastLoans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.book_title}</td>
                  <td>{formatDate(loan.issue_date)}</td>
                  <td>{formatDate(loan.return_date)}</td>
                  <td>{loan.fine_amount} Tk</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
