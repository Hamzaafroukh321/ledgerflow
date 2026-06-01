import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { createLedgerFlowQueryClient } from "./lib/queryClient";
import { createAppRouter } from "./routes";

const queryClient = createLedgerFlowQueryClient();
const router = createAppRouter();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
