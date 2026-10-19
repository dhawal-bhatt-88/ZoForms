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

  it("takes the caller's id, and builds the hint's and error's from it", () => {
    render(
      <Field id="block-name" label="Name" hint="Used in formulas" error="Taken" optional={false}>
        {(field) => <Input {...field} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.id).toBe("block-name");
    expect(input.getAttribute("aria-describedby")).toBe("block-name-hint block-name-error");
  });

  it("`optional` marks a field that isn't required, and `optional={false}` doesn't", () => {
    render(
      <>
        <Field label="Help text" optional>{(field) => <Input {...field} />}</Field>
        <Field label="Label" optional={false}>{(field) => <Input {...field} />}</Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Help text optional" })).toHaveProperty("required", false);
    expect(screen.getByRole("textbox", { name: "Label" })).toHaveProperty("required", false);
  });

  it("a live error's region is there, and described by, before there is a message", () => {
    const { rerender } = render(
      <Field id="logic" label="Logic" optional={false} liveError>
        {(field) => <Input {...field} />}
      </Field>,
    );
    const region = document.getElementById("logic-error")!;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe("logic-error");
    rerender(
      <Field id="logic" label="Logic" optional={false} liveError error="Close the bracket.">
        {(field) => <Input {...field} />}
      </Field>,
    );
    expect(document.getElementById("logic-error")).toBe(region);
    expect(region.textContent).toBe("Close the bracket.");
  });

  it("adds the caller's own descriptions after its own", () => {
    render(
      <>
        <Field label="Name" hint="Lower case" describedBy="status" optional={false}>
          {(field) => <Input {...field} />}
        </Field>
        <p id="status">2 formulas updated.</p>
      </>,
    );
    const ids = screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-describedby")!.split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(["Lower case", "2 formulas updated."]);
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
