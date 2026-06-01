import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";

interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {};

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("LedgerFlow UI error", error, info.componentStack);
  }

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-950">
          <section className="max-w-xl rounded-md border border-rose-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Interface error</p>
            <h1 className="mt-2 text-2xl font-semibold">LedgerFlow could not render this view.</h1>
            <p className="mt-3 text-slate-600">{this.state.error.message}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
