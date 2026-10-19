// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { TOAST_MS, ToastProvider, useToast, type ToastTone } from "./toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Raise({ tone, title }: { tone: ToastTone; title: string }) {
  const toast = useToast();
  return <button onClick={() => toast.show({ tone, title })}>raise {title}</button>;
}

function region() {
  return document.querySelector<HTMLElement>("[data-toasts]")!;
}

describe("toast announcements", () => {
  it("has a polite live region before any toast, so the first one is announced", () => {
    render(<ToastProvider>page</ToastProvider>);
    expect(region().getAttribute("aria-live")).toBe("polite");
    expect(region().children).toHaveLength(0);
  });

  it("announces a success as a status, in the live region", () => {
    render(
      <ToastProvider>
        <Raise tone="pass" title="Duplicated Intake." />
      </ToastProvider>,
    );
    act(() => screen.getByRole("button", { name: /raise/ }).click());
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Duplicated Intake.");
    expect(region().contains(status)).toBe(true);
  });

  it("announces a failure as an alert", () => {
    render(
      <ToastProvider>
        <Raise tone="fail" title="Couldn't download Intake." />
      </ToastProvider>,
    );
    act(() => screen.getByRole("button", { name: /raise/ }).click());
    expect(screen.getByRole("alert").textContent).toContain("Couldn't download Intake.");
  });

  it("a success goes after six seconds; a failure stays until dismissed", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Raise tone="pass" title="Saved." />
        <Raise tone="fail" title="Couldn't save." />
      </ToastProvider>,
    );
    act(() => screen.getByRole("button", { name: "raise Saved." }).click());
    act(() => screen.getByRole("button", { name: "raise Couldn't save." }).click());
    act(() => vi.advanceTimersByTime(TOAST_MS + 1));
    expect(screen.queryByRole("status")).toBeNull();
    const alert = screen.getByRole("alert");
    act(() => alert.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!.click());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is a no-op outside a provider rather than an error", () => {
    render(<Raise tone="pass" title="Nobody hears this." />);
    expect(() => act(() => screen.getByRole("button").click())).not.toThrow();
  });
});
