import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AuthController } from "./auth.controller";
import { InvitesController } from "../team/invites.controller";

type Handler = (...args: never[]) => unknown;
const guardsOf = (target: object): unknown[] => Reflect.getMetadata(GUARDS_METADATA, target) ?? [];
const handler = (controller: { prototype: object }, name: string): Handler =>
  (controller.prototype as Record<string, Handler>)[name];

describe("throttling", () => {
  const credential: [{ name: string; prototype: object }, string][] = [
    [AuthController, "signup"],
    [AuthController, "login"],
    [AuthController, "google"],
    [AuthController, "forgotPassword"],
    [AuthController, "resetPassword"],
    [AuthController, "verifyEmail"],
    [AuthController, "resend"],
    [InvitesController, "accept"],
  ];

  it.each(credential.map(([c, name]) => ({ c, name, route: `${c.name}.${name}` })))("$route is throttled", ({ c: controller, name }) => {
    expect(handler(controller, name)).toBeTypeOf("function");
    expect(guardsOf(handler(controller, name))).toContain(ThrottlerGuard);
  });

  it.each(["me", "updatePreferences"])("AuthController.%s isn't", (name) => {
    expect(handler(AuthController, name)).toBeTypeOf("function");
    expect(guardsOf(handler(AuthController, name))).not.toContain(ThrottlerGuard);
  });

  it("no controller throttles every route it has", () => {
    expect(guardsOf(AuthController)).not.toContain(ThrottlerGuard);
    expect(guardsOf(InvitesController)).not.toContain(ThrottlerGuard);
  });
});
