import { PageShell } from "@/components/common/page-shell";
import { SettingsFields } from "@/components/map/map-panels";
export const metadata = { title: "Settings" };
export default function SettingsPage() {
  return (
    <PageShell>
      <div className="eyebrow">LOCAL PREFERENCES</div>
      <h1>Settings</h1>
      <div className="settings-fields">
        <SettingsFields />
      </div>
    </PageShell>
  );
}
