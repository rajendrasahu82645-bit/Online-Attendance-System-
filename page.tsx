"use client";
export default function Home() {
  return (
    <div className="dashboard-container animate-fade-in">
      <header className="dashboard-header">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="text-muted">Welcome back! Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary">Generate Report</button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card glass glass-hover">
          <span className="stat-label">Total Students</span>
          <span className="stat-value">124</span>
          <span className="stat-change success">+12 this month</span>
        </div>
        <div className="stat-card glass glass-hover">
          <span className="stat-label">Present Today</span>
          <span className="stat-value">108</span>
          <span className="stat-change success">87% attendance</span>
        </div>
        <div className="stat-card glass glass-hover">
          <span className="stat-label">Absent Today</span>
          <span className="stat-value">16</span>
          <span className="stat-change danger">6 critical</span>
        </div>
      </div>

      <section className="recent-activity glass">
        <div className="section-header">
          <h2 className="h2">Recent Attendance</h2>
          <button className="btn-ghost">View All</button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Roll Number</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "John Doe", roll: "CS001", status: "Present", time: "09:00 AM" },
                { name: "Jane Smith", roll: "CS002", status: "Present", time: "09:05 AM" },
                { name: "Robert Brown", roll: "CS003", status: "Absent", time: "---" },
                { name: "Emily Davis", roll: "CS004", status: "Late", time: "09:20 AM" },
              ].map((row, i) => (
                <tr key={i}>
                  <td>{row.name}</td>
                  <td><code>{row.roll}</code></td>
                  <td>
                    <span className={`status-badge ${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .stat-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .stat-label {
          color: var(--text-muted);
          font-size: 0.875rem;
          font-weight: 500;
        }
        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
        }
        .stat-change {
          font-size: 0.875rem;
          font-weight: 600;
        }
        .stat-change.success { color: var(--success); }
        .stat-change.danger { color: var(--danger); }

        .recent-activity {
          padding: 1.5rem;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .table-wrapper {
          overflow-x: auto;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .data-table th {
          padding: 1rem;
          border-bottom: 1px solid var(--surface-border);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.875rem;
        }
        .data-table td {
          padding: 1rem;
          border-bottom: 1px solid var(--surface-border);
        }
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-badge.present { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-badge.absent { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .status-badge.late { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
      `}</style>
    </div>
  );
}
