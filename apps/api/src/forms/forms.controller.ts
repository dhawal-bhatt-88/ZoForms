import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { FormsService } from "./forms.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("v1/forms")
@UseGuards(AuthGuard)
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.forms.list(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.forms.get(user, id);
  }

  /** A blank form, or with `templateId` a new form from a form template. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { title?: string; templateId?: unknown }) {
    if (body?.templateId !== undefined) return this.forms.createFromTemplate(user, body.templateId);
    return this.forms.create(user, body?.title?.trim() || "Untitled form");
  }

  /**
   * `?baseVersion=N`: the version the edit started from. If it isn't the latest
   * any more, nothing is saved (409 VERSION_CONFLICT). The editor always sends it.
   */
  @Put(":id/schema")
  saveSchema(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("baseVersion") baseVersion?: string,
  ) {
    return this.forms.saveSchema(user, id, body, baseVersion);
  }

  /** Download the current version as a schema artifact. Read-only. */
  @Get(":id/artifact")
  async artifact(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fileName, artifact } = await this.forms.getArtifact(user, id);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return `${JSON.stringify(artifact, null, 2)}\n`;
  }

  @Get(":id/versions")
  versions(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.forms.listVersions(user, id);
  }

  @Post(":id/versions/:versionId/restore")
  restore(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ) {
    return this.forms.restoreVersion(user, id, versionId);
  }

  @Post(":id/duplicate")
  duplicate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.forms.duplicate(user, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.forms.remove(user, id);
  }
}
