import { useSettings } from "@/context/SettingsContext";
import { SettingsPage } from "./SettingsPage";

export function SettingsPageWrapper() {
  const { settings, updateSettings } = useSettings();

  return (
    <SettingsPage
      settings={settings}
      onUpdateSettings={updateSettings}
      onClearAllData={() => {
        // Implementar limpeza de dados
      }}
    />
  );
}