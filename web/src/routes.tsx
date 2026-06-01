import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { Layout } from "./components/Layout";
import { OverviewPage } from "./pages/OverviewPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <OverviewPage />
      }
    ]
  }
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
