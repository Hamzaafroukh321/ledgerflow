import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { releaseInfo } from "../lib/releaseInfo";
import { ReleaseFooter } from "./ReleaseFooter";

describe("ReleaseFooter", () => {
  it("renders the product release", () => {
    render(<ReleaseFooter />);

    expect(screen.getByText(`${releaseInfo.name} ${releaseInfo.release}`)).toBeInTheDocument();
  });

  it("links to API docs", () => {
    render(<ReleaseFooter />);

    expect(screen.getByRole("link", { name: /api docs/i })).toHaveAttribute(
      "href",
      releaseInfo.docsPath
    );
  });

  it("links to the OpenAPI document", () => {
    render(<ReleaseFooter />);

    expect(screen.getByRole("link", { name: /openapi/i })).toHaveAttribute(
      "href",
      releaseInfo.openApiPath
    );
  });

  it("exposes release resources as navigation", () => {
    render(<ReleaseFooter />);

    expect(screen.getByRole("navigation", { name: /release resources/i })).toBeInTheDocument();
  });
});
