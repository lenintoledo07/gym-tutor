import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, Dumbbell, Home, MessageCircle, User } from "lucide-react";

const links = [
  { to: "/", label: "Hoy", icon: Home, end: true },
  { to: "/coach", label: "Coach", icon: MessageCircle },
  { to: "/progreso", label: "Progreso", icon: BarChart3 },
  { to: "/ejercicios", label: "Ejercicios", icon: Dumbbell },
  { to: "/perfil", label: "Perfil", icon: User },
];

export default function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-bold">Gym Tutor</span>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive ? "bg-brand/15 text-brand" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">
        <Outlet />
      </main>

      {/* Barra inferior móvil */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md justify-around pt-2">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex w-16 flex-col items-center gap-1 text-[11px] ${isActive ? "text-brand" : "text-slate-500"}`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
