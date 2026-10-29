// @vitest-environment jsdom
import { forwardRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
    return <a ref={ref} {...props} />;
  }),
}));

const { AuthForm } = await import("./auth-form");
const NOTICE = "Your session has ended. Sign in again to continue.";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("sign-in after a refused session", () => {
  it("says the session ended when sent here by a 401", async () => {
    window.history.replaceState(null, "", "/login?signedOut=1");
    render(<AuthForm mode="login" />);
    expect((await screen.findByRole("status")).textContent).toContain(NOTICE);
  });

  it("says nothing on an ordinary visit", () => {
    window.history.replaceState(null, "", "/login");
    render(<AuthForm mode="login" />);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("never on sign-up", () => {
    window.history.replaceState(null, "", "/signup?signedOut=1");
    render(<AuthForm mode="signup" />);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});
