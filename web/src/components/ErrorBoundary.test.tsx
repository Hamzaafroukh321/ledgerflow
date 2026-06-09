import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

function BrokenView(): JSX.Element {
  throw new Error("Broken view");
}

describe("ErrorBoundary", () => {
  it("renders a controlled failure state", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", preventExpectedError);

    try {
      render(
        <ErrorBoundary>
          <BrokenView />
        </ErrorBoundary>
      );

      expect(screen.getByRole("heading", { name: /could not render/i })).toBeInTheDocument();
      expect(screen.getByText("Broken view")).toBeInTheDocument();
    } finally {
      window.removeEventListener("error", preventExpectedError);
      spy.mockRestore();
    }
  });
});
