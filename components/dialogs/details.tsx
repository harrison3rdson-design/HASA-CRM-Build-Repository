import type { ReactNode } from "react";

export function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="detail-grid">{children}</dl>;
}

export function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value ?? "—"}</dd></div>;
}

export function SectionTabs({
  tabs,
  active,
}: {
  tabs: Array<{ label: string; href: string }>;
  active: string;
}) {
  return (
    <nav className="section-tabs">
      {tabs.map(t => (
        <a key={t.href} href={t.href} className={active === t.href ? "active" : ""}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
