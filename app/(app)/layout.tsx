import type { ReactNode } from "react";
import Link from "next/link";
import "@/styles/app.css";

const nav = [
  ["Dashboard","/dashboard"],["Clients","/clients"],["Proposals","/proposals"],
  ["Projects","/projects"],["Time","/time"],["Expenses","/expenses"],
  ["Receipt Inbox","/receipts"],["Billing","/billing"],["Documents","/documents"],
  ["Reports","/reports"],["Settings","/settings"]
];

export default function AppLayout({children}:{children:ReactNode}) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">HASA</div><div className="brand-sub">CONCEPTS</div></div>
      <nav className="nav">{nav.map(([label,href])=><Link key={href} href={href} className="nav-link">{label}</Link>)}</nav>
    </aside>
    <div className="main-area">
      <header className="topbar"><strong>HASA Concepts Management</strong><span className="muted">Release 1</span></header>
      <main className="content">{children}</main>
    </div>
  </div>;
}
