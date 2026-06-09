import { NavLink } from "react-router-dom";

import { useSession } from "./sessionContext";

const links = [
  { to: "/", label: "Overview" },
  { to: "/plans", label: "Plans" },
  { to: "/simulator", label: "Simulator" },
  { to: "/simulations", label: "Saved simulations" },
  { to: "/audit", label: "Audit" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/customers", label: "Customers", write: true },
  { to: "/usage", label: "Usage", write: true },
  { to: "/refunds", label: "Refunds" }
];

export function Nav() {
  const { session } = useSession();
  const canWrite = session?.role === "editor" || session?.role === "admin";
  const visibleLinks = links.filter((link) => !link.write || canWrite);
  return (
    <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
      {visibleLinks.map((link) => (
        <NavLink
          className={({ isActive }) =>
            [
              "rounded-md px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-slate-950 text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            ].join(" ")
          }
          key={link.to}
          to={link.to}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
