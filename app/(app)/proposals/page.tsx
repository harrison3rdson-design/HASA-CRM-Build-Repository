import Link from "next/link";
import { Panel } from "@/components/cards";
import { getProposals } from "@/lib/data/app-data";
import { proposalRevisionLabel } from "@/lib/proposal-revisions";

export default async function Page() {
  const rows: any[] = await getProposals();

  return (
    <>
      <div className="page-heading">
        <div><h1>Proposals</h1><p>Create, revise, send, and track acceptance.</p></div>
        <Link className="primary-button" href="/proposals/new">New Proposal</Link>
      </div>
      <Panel title="Proposal Register">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Proposal</th><th>Client</th><th>Project</th><th>Version</th><th>Status</th></tr></thead>
            <tbody>{rows.map((proposal) => (
              <tr key={proposal.id}>
                <td><Link href={`/proposals/${proposal.id}`}>{proposal.proposal_number}</Link></td>
                <td>{proposal.client?.company_name ?? "—"}</td>
                <td>{proposal.project_name}</td>
                <td>{proposalRevisionLabel(proposal.current_revision)}</td>
                <td><span className="pill">{proposal.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
