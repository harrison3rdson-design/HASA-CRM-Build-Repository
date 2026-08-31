import { Panel } from "@/components/cards";
import { SettingsForm } from "@/components/forms/settings-form";
import { getCompanySettings } from "@/lib/data/app-data";

export default async function Page() {
  const settings: any = await getCompanySettings();

  return (
    <>
      <div className="page-heading">
        <div><h1>Settings</h1><p>Company, branding, billing defaults, and integrations.</p></div>
      </div>
      <Panel title="Company Settings">
        <SettingsForm settings={settings} />
      </Panel>
    </>
  );
}
