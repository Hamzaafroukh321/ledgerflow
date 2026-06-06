import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSession } from "./sessionContext";

function Probe() {
  useSession();
  return null;
}

describe("sessionContext", () => {
  it("requires SessionProvider", () => {
    expect(() => render(<Probe />)).toThrow("useSession must be used within SessionProvider");
  });
});
