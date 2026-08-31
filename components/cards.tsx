import type { ReactNode } from "react";
export function MetricCard({label,value}:{label:string;value:ReactNode}) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>;
}
export function Panel({title,children}:{title:string;children:ReactNode}) {
  return <section className="panel"><div className="panel-header"><h2>{title}</h2></div>{children}</section>;
}
