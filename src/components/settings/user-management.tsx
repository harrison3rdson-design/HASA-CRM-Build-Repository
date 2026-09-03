"use client";

import { useActionState } from "react";
import { inviteUserAction, manageUserAction, type UserAdministrationActionState } from "@/app/actions/user-administration";
import type { AppRole } from "@/lib/auth/roles";
import type { ManagedUser } from "@/lib/data/user-administration";

const initialState: UserAdministrationActionState = { status: "idle", message: "" };
const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "owner_admin", label: "Owner Administrator" },
  { value: "project_manager", label: "Project Manager" },
  { value: "staff", label: "Staff" },
  { value: "accounting", label: "Accounting" },
  { value: "read_only", label: "Read Only" },
];

function roleLabel(role: AppRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function dateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StateMessage({ state }: { state: UserAdministrationActionState }) {
  if (!state.message) return null;
  return <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteUserAction, initialState);
  return (
    <form action={action} className="form-grid user-invite-form">
      <label>First Name<input name="first_name" autoComplete="given-name" required /></label>
      <label>Last Name<input name="last_name" autoComplete="family-name" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Role<select name="role" defaultValue="staff" required>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="full form-submit-row">
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Sending…" : "Invite User"}</button>
        <StateMessage state={state} />
      </div>
    </form>
  );
}

function UserAccessRow({ user, isCurrentUser }: { user: ManagedUser; isCurrentUser: boolean }) {
  const [state, action, pending] = useActionState(manageUserAction, initialState);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed user";
  const accessStatus = !user.active ? "Disabled" : !user.authUserId ? "Not linked" : !user.emailConfirmedAt ? "Invitation pending" : "Active";

  return (
    <tr>
      <td><strong>{name}</strong>{isCurrentUser ? <span className="pill current-user-pill">You</span> : null}</td>
      <td>{user.email}</td>
      <td><span className={`pill user-status-${accessStatus.toLowerCase().replaceAll(" ", "-")}`}>{accessStatus}</span></td>
      <td>{dateTime(user.lastSignInAt)}</td>
      <td>
        <form action={action} className="user-access-form">
          <input type="hidden" name="user_id" value={user.id} />
          <select name="role" defaultValue={user.role} aria-label={`Role for ${name}`} disabled={pending || isCurrentUser}>
            {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label className="user-active-check"><input name="active" type="checkbox" defaultChecked={user.active} disabled={pending || isCurrentUser} /> Active</label>
          <button className="secondary-button" type="submit" name="intent" value="update" disabled={pending || isCurrentUser}>{pending ? "Working…" : "Save Access"}</button>
          <button className="secondary-button" type="submit" name="intent" value="resend" disabled={pending || !user.active || !user.authUserId}>Send Account Link</button>
        </form>
        <div className="user-row-message"><StateMessage state={state} /></div>
        {isCurrentUser ? <p className="footnote">Your own Owner Administrator access is protected.</p> : null}
      </td>
      <td>{roleLabel(user.role)}</td>
    </tr>
  );
}

export function UserManagement({ users, currentAppUserId }: { users: ManagedUser[]; currentAppUserId: string }) {
  return (
    <div className="user-management">
      <p className="settings-section-intro">Invite people to the management application and control their access. Only Owner Administrators can view or change this area.</p>
      <div className="user-management-grid">
        <section className="user-management-card" aria-labelledby="invite-user-title">
          <h3 id="invite-user-title">Invite a User</h3>
          <p className="muted">The user receives a secure email link to choose a password.</p>
          <InviteUserForm />
        </section>
        <section className="user-management-card role-guide" aria-labelledby="role-guide-title">
          <h3 id="role-guide-title">Role Guide</h3>
          <dl>
            <div><dt>Owner Administrator</dt><dd>Full access, company settings, and user administration.</dd></div>
            <div><dt>Project Manager</dt><dd>Clients, proposals, projects, time, expenses, and invoice creation.</dd></div>
            <div><dt>Staff</dt><dd>Internal records, assigned work, time, expenses, and documents.</dd></div>
            <div><dt>Accounting</dt><dd>Billing, payments, expenses, documents, and financial records.</dd></div>
            <div><dt>Read Only</dt><dd>Internal viewing without create, edit, send, or payment authority.</dd></div>
          </dl>
        </section>
      </div>
      <div className="table-wrap user-access-table">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Status</th><th>Last Sign In</th><th>Access Controls</th><th>Current Role</th></tr></thead>
          <tbody>{users.map((user) => <UserAccessRow key={user.id} user={user} isCurrentUser={user.id === currentAppUserId} />)}</tbody>
        </table>
      </div>
      <style jsx>{`
        .settings-section-intro{margin:0 0 16px;color:var(--muted);line-height:1.5}
        .user-management-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:18px;margin-bottom:20px}
        .user-management-card{border:1px solid var(--border);border-radius:10px;padding:16px;background:#fafbfc}
        .user-management-card h3{margin:0 0 6px;font-size:15px}.user-management-card>p{margin:0 0 14px;font-size:13px}
        .role-guide dl{display:grid;gap:10px;margin:14px 0 0}.role-guide dl div{display:grid;gap:2px}.role-guide dt{font-size:12px;font-weight:700}.role-guide dd{margin:0;color:var(--muted);font-size:12px;line-height:1.4}
        .user-invite-form{margin-top:14px}.user-access-table :global(table){min-width:1120px}.user-access-table :global(td){vertical-align:top}
        .current-user-pill{margin-left:8px}.user-access-form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:470px}
        .user-access-form select{padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:#fff;font:inherit;font-size:12px}
        .user-active-check{display:flex;align-items:center;gap:5px;font-size:12px;white-space:nowrap}.user-row-message{margin-top:7px}.user-row-message :global(.form-message){max-width:520px}
        .user-status-active{background:#e9f7ef;color:#18794e}.user-status-disabled{background:#fff1f1;color:#991b1b}.user-status-invitation-pending{background:#fff8e6;color:#8a5a00}
        @media(max-width:900px){.user-management-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
