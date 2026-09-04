import { Panel } from "@/components/cards";
import { SettingsForm } from "@/components/forms/settings-form";
import { MfaManagement } from "@/components/settings/mfa-management";
import { UserManagement } from "@/components/settings/user-management";
import { getCurrentAppUser } from "@/lib/auth/server";
import { getCompanySettings } from "@/lib/data/app-data";
import { getManagedUsers } from "@/lib/data/user-administration";

export default async function Page() {
  const [{ appUser }, settings] = await Promise.all([getCurrentAppUser(), getCompanySettings()]);
  const managedUsers = appUser?.role === "owner_admin" ? await getManagedUsers() : null;

  return (
    <>
      <div className="page-heading">
        <div><h1>Settings</h1><p>Company, branding, billing defaults, integrations, account security, and user access.</p></div>
      </div>
      <Panel title="Company Settings">
        <SettingsForm settings={settings} />
      </Panel>
      <Panel title="Account Security">
        <MfaManagement />
      </Panel>
      {managedUsers ? (
        <>
          <Panel title="User Access & Roles">
            <UserManagement users={managedUsers.users} currentAppUserId={managedUsers.currentAppUserId} />
          </Panel>
          <Panel title="Backup & Recovery">
            <p className="muted">
              Download a point-in-time copy of all management records and private stored documents.
              The file contains confidential customer information and should be kept in an encrypted,
              access-controlled location outside this application.
            </p>
            <form method="post" action="/api/admin/recovery-backup">
              <button className="primary-button" type="submit">Download Recovery Backup</button>
            </form>
            <p className="footnote">
              Only an Owner Administrator with completed MFA can create this backup. Passwords,
              active sessions, provider keys, and authenticator secrets are never included.
            </p>
          </Panel>
        </>
      ) : null}
    </>
  );
}
