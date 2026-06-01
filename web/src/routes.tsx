import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AuditPage } from "./pages/AuditPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlansPage } from "./pages/PlansPage";
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
      }
    ]
  }
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
