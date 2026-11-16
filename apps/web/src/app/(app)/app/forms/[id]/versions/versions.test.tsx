// @vitest-environment jsdom
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type FormVersion } from "@/lib/api";
import { ToastProvider } from "@/components/ui";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "f1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
    return <a ref={ref} {...props} />;
  }),
}));

/** Twelve versions, newest first, as the API lists them: the ten most recent downloadable. */
const versions: FormVersion[] = Array.from({ length: 12 }, (_, i) => ({
  id: `v${12 - i}`, version: 12 - i, label: null, createdAt: "2026-11-16T10:00:00.000Z", downloadable: i < 10,
}));
const downloadArtifact = vi.fn();

vi.mock("@/lib/api", async (actual) => ({
  ...(await actual<typeof import("@/lib/api")>()),
  getForm: () => Promise.resolve({ id: "f1", title: "PHQ-9", createdAt: "", updatedAt: "", versions: [] }),
  listVersions: () => Promise.resolve(versions),
  downloadArtifact: (...args: unknown[]) => downloadArtifact(...args),
}));

const { default: VersionsPage } = await import("./page");

async function open() {
  render(
    <ToastProvider>
      <VersionsPage />
    </ToastProvider>,
  );
  await screen.findByRole("button", { name: "Restore v1" });
}

beforeEach(() => {
  downloadArtifact.mockReset();
});
afterEach(cleanup);

describe("the versions page's Download", () => {
  it("is on each version the API says can be downloaded, and on no other", async () => {
    await open();
    const offered = screen.getAllByRole("button", { name: /^Download v/ }).map((b) => b.getAttribute("aria-label"));
    expect(offered).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `Download v${n}`));
    // The older versions keep Restore.
    for (const n of [2, 1]) expect(screen.getByRole("button", { name: `Restore v${n}` })).toBeTruthy();
  });

  it("says in one line that only the 10 most recent versions can be downloaded", async () => {
    await open();
    expect(screen.getByText(/Only the 10 most recent versions can be downloaded\./)).toBeTruthy();
  });

  it("downloads that version, and says which file", async () => {
    downloadArtifact.mockResolvedValue("phq-9-v5.json");
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Download v5" }));
    expect(downloadArtifact).toHaveBeenCalledWith("f1", "v5");
    const toast = await screen.findByRole("status");
    expect(within(toast).getByText("Downloaded v5.")).toBeTruthy();
    expect(within(toast).getByText("phq-9-v5.json")).toBeTruthy();
  });

  it("shows the API's reason when a version can't be downloaded", async () => {
    downloadArtifact.mockRejectedValue(new ApiError("The renderer would refuse this form: Block \"q\" has unknown type \"signature\".", 422, "FORM_INVALID"));
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Download v3" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't download v3.")).toBeTruthy();
    expect(within(alert).getByText(/unknown type "signature"/)).toBeTruthy();
  });
});
