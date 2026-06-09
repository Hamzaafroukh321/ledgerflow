import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSession } from "./sessionContext";

function Probe() {
  useSession();
  return null;
}

describe("sessionContext", () => {
  it("requires SessionProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", preventExpectedError);

    try {
      expect(() => render(<Probe />)).toThrow("useSession must be used within SessionProvider");
    } finally {
      window.removeEventListener("error", preventExpectedError);
      spy.mockRestore();
    }
  });
});
