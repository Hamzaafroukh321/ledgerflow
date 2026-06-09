import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { RequireSession, RequireWriteRole } from "./components/AuthGuards";
import { Layout } from "./components/Layout";
import { AuditPage } from "./pages/AuditPage";
import { CustomersPage } from "./pages/CustomersPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlansPage } from "./pages/PlansPage";
import { RefundPage } from "./pages/RefundPage";
import { ScenarioPage } from "./pages/ScenarioPage";
import { SimulationsPage } from "./pages/SimulationsPage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { UsagePage } from "./pages/UsagePage";

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/",
    element: <RequireSession />,
    children: [
      {
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
            path: "simulations",
            element: <SimulationsPage />
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
            element: (
              <RequireWriteRole>
                <CustomersPage />
              </RequireWriteRole>
            )
          },
          {
            path: "usage",
            element: (
              <RequireWriteRole>
                <UsagePage />
              </RequireWriteRole>
            )
          },
          {
            path: "refunds",
            element: <RefundPage />
          }
        ]
      }
    ]
  }
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
