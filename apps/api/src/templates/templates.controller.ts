import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { TemplatesService } from "./templates.service";

/**
 * Form and group templates: the caller's organisation's, which its authors
 * manage, and system templates, which everyone sees and nobody changes here.
 * Inserting a template happens in the editor; creating a form from one is
 * `POST /v1/forms` with a `templateId`.
 */
@Controller("v1/templates")
@UseGuards(AuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("kind") kind?: string) {
    return this.templates.list(user, kind);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.templates.get(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { kind?: unknown; name?: unknown; description?: unknown; content?: unknown },
  ) {
    return this.templates.create(user, body ?? {});
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { kind?: unknown; name?: unknown; description?: unknown; content?: unknown; version?: unknown },
  ) {
    return this.templates.update(user, id, body ?? {});
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.templates.remove(user, id);
  }

  @Post(":id/duplicate")
  duplicate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.templates.duplicate(user, id);
  }
}
