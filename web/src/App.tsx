import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { SessionProvider } from "./components/SessionProvider";
import { createLedgerFlowQueryClient } from "./lib/queryClient";
import { createAppRouter } from "./routes";

const queryClient = createLedgerFlowQueryClient();
const router = createAppRouter();

function App() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}

export default App;
