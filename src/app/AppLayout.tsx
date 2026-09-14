import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimulatedBanner from "./components/SimulatedBanner";
import { useAuth } from "./auth/useAuth";
import { ROLE_LABEL, type Role } from "./lib/platform";

const NAV: { to: string; label: string; roles?: Role[] }[] = [
  { to: "/app/community", label: "Communities" },
  { to: "/app/admin", label: "Review queue", roles: ["admin"] },
];

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const links = NAV.filter((n) => !n.roles || (profile && n.roles.includes(profile.role)));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/app" className="font-heading text-xl font-bold text-gradient">
              EmpowerFI
            </Link>
            <nav className="hidden items-center gap-5 sm:flex" aria-label="Platform">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `text-sm transition-colors hover:text-foreground ${isActive ? "text-foreground" : "text-muted-foreground"}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">{profile.display_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[profile.role]}</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
                <LogOut size={14} /> Sign out
              </Button>
            </div>
          )}
        </div>
        {/* Phones get the same links under the bar. */}
        <nav className="flex gap-5 border-t border-border px-4 py-2 sm:hidden" aria-label="Platform">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <SimulatedBanner />
      <main className="container mx-auto px-4 py-8 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
