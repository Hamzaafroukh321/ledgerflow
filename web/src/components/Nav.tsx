import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Overview" },
  { to: "/plans", label: "Plans" },
  { to: "/simulator", label: "Simulator" },
  { to: "/audit", label: "Audit" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/customers", label: "Customers" },
  { to: "/usage", label: "Usage" },
  { to: "/refunds", label: "Refunds" }
];

export function Nav() {
  return (
    <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
      {links.map((link) => (
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
