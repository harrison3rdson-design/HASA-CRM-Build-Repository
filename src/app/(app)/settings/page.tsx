import { Panel } from "@/components/cards";
import { SettingsForm } from "@/components/forms/settings-form";
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
        <div><h1>Settings</h1><p>Company, branding, billing defaults, integrations, and user access.</p></div>
      </div>
      <Panel title="Company Settings">
        <SettingsForm settings={settings} />
      </Panel>
      {managedUsers ? (
        <Panel title="User Access & Roles">
          <UserManagement users={managedUsers.users} currentAppUserId={managedUsers.currentAppUserId} />
        </Panel>
      ) : null}
    </>
  );
}
