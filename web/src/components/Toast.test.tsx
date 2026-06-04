import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders nothing without a message", () => {
    const { container } = render(<Toast />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders each tone and optional detail", () => {
    const { rerender } = render(<Toast message={{ tone: "success", title: "Saved", detail: "Plan updated" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByText("Plan updated")).toBeInTheDocument();

    rerender(<Toast message={{ tone: "error", title: "Failed" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Failed");
    expect(screen.queryByText("Plan updated")).not.toBeInTheDocument();

    rerender(<Toast message={{ tone: "info", title: "Queued" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Queued");
  });
});
