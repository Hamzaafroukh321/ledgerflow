import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { Layout } from "./components/Layout";
import { OverviewPage } from "./pages/OverviewPage";
import { PlansPage } from "./pages/PlansPage";

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
      }
    ]
  }
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
