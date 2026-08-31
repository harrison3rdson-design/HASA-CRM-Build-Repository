import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/server";
import "@/styles/app.css";
import "@/styles/phase6-forms.css";
import "@/styles/phase7-details.css";

const nav = [
  ["Dashboard","/dashboard"],["Clients","/clients"],["Proposals","/proposals"],
  ["Projects","/projects"],["Time","/time"],["Expenses","/expenses"],
  ["Receipt Inbox","/receipts"],["Billing","/billing"],["Documents","/documents"],
  ["Reports","/reports"],["Settings","/settings"]
];

export default async function AppLayout({children}:{children:ReactNode}) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">HASA</div><div className="brand-sub">CONCEPTS</div></div>
      <nav className="nav">{nav.map(([label,href])=><Link key={href} href={href} className="nav-link">{label}</Link>)}</nav>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <strong>HASA Concepts Management</strong>
        <div className="topbar-actions"><span className="muted">Release 1</span><form action={signOutAction}><button className="secondary-button" type="submit">Sign Out</button></form></div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}
