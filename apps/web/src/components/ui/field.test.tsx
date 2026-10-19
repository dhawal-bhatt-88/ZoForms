// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Field, Input } from "./field";

afterEach(cleanup);

describe("Field's bindings", () => {
  it("names the control by its label", () => {
    render(<Field label="Email" required>{(field) => <Input {...field} />}</Field>);
    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
  });

  it("describes the control by its hint", () => {
    render(
      <Field label="Role" hint="Create and edit forms" required>
        {(field) => <Input {...field} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Role" });
    const hint = screen.getByText("Create and edit forms");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("an error describes the control and marks it invalid", () => {
    render(
      <Field label="Email" hint="Their work address" error="Enter a valid email address." required>
        {(field) => <Input {...field} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    const texts = ids.map((id) => document.getElementById(id)?.textContent);
    // Every id points at something, and both the hint and the error are read.
    expect(texts).toEqual(["Their work address", "Enter a valid email address."]);
  });

  it("marks the optional field, not the required one", () => {
    render(
      <>
        <Field label="Name">{(field) => <Input {...field} />}</Field>
        <Field label="Email" required>{(field) => <Input {...field} />}</Field>
      </>,
    );
    // "optional" is its own word in the accessible name.
    expect(screen.getByRole("textbox", { name: "Name optional" })).toHaveProperty("required", false);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveProperty("required", true);
  });

  it("gives each field its own ids", () => {
    render(
      <>
        <Field label="One" hint="First">{(field) => <Input {...field} />}</Field>
        <Field label="Two" hint="Second">{(field) => <Input {...field} />}</Field>
      </>,
    );
    const one = screen.getByRole("textbox", { name: /^One/ });
    const two = screen.getByRole("textbox", { name: /^Two/ });
    expect(one.id).not.toBe(two.id);
    expect(document.getElementById(two.getAttribute("aria-describedby")!)?.textContent).toBe("Second");
  });
});
