import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Online Attendance System V2",
  description: "A premium, modern attendance management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="layout">
          <aside className="sidebar glass">
            <div className="logo">
              <span className="gradient-text h2">AttendEase</span>
            </div>
            <nav className="nav-menu">
              <Link href="/" className="nav-link active">Dashboard</Link>
              <Link href="/students" className="nav-link">Students</Link>
              <Link href="/attendance" className="nav-link">Mark Attendance</Link>
              <Link href="/reports" className="nav-link">Reports</Link>
            </nav>
            <div className="sidebar-footer">
              <p className="text-muted">Version 2.0</p>
            </div>
          </aside>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
