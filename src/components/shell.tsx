import {
  Braces,
  History,
  Radio,
  Server,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useI18n } from "../i18n";
import { useUpdater } from "../lib/updater";
import { useWorkspace } from "../workspace-context";

const appIconUrl = new URL("../../app-icon.png", import.meta.url).href;

export function Shell() {
  const { snapshot } = useWorkspace();
  const { t } = useI18n();
  const { status, checkForUpdate } = useUpdater();
  const updateAvailable = status.state === "available";
  const nav = [
    { to: "/requests", label: t("requests"), icon: Braces },
    { to: "/environment", label: t("environment"), icon: SlidersHorizontal },
    { to: "/history", label: t("history"), icon: History },
    { to: "/realtime", label: t("realtime"), icon: Radio },
    { to: "/mcp", label: t("mcpServer"), icon: Server },
  ];

  useEffect(() => {
    if (!snapshot.settings.checkForUpdates) return;
    const timer = window.setTimeout(() => void checkForUpdate(), 3_000);
    return () => window.clearTimeout(timer);
  }, [snapshot.settings.checkForUpdates, checkForUpdate]);

  return (
    <div className="app-shell">
      <nav className="nav-rail" aria-label="Primary navigation">
        <div className="brand-mark" aria-label="Watcher">
          <img src={appIconUrl} alt="" aria-hidden />
        </div>
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="nav-link" title={label}>
            <Icon size={19} aria-hidden />
            <span className="sr-only">{label}</span>
          </NavLink>
        ))}
        <div className="nav-spacer" />
        <NavLink to="/settings" className="nav-link" title={t("settings")}>
          <Settings size={19} aria-hidden />
          {updateAvailable && <span className="update-dot" />}
          <span className="sr-only">{t("settings")}</span>
        </NavLink>
      </nav>
      <main className="shell-content">
        <Outlet />
      </main>
    </div>
  );
}
