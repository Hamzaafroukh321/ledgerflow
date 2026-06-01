import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AuditPage } from "./pages/AuditPage";
import { CustomersPage } from "./pages/CustomersPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlansPage } from "./pages/PlansPage";
import { ScenarioPage } from "./pages/ScenarioPage";
import { SimulatorPage } from "./pages/SimulatorPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <OverviewPage />
      },
      {
        path: "plans",
        element: <PlansPage />
      },
      {
        path: "simulator",
        element: <SimulatorPage />
      },
      {
        path: "audit",
        element: <AuditPage />
      },
      {
        path: "scenarios",
        element: <ScenarioPage />
      },
      {
        path: "customers",
        element: <CustomersPage />
      }
    ]
  }
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
