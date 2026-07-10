import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { FormStatus } from "@prisma/client";
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

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { title?: string }) {
    return this.forms.create(user, body?.title?.trim() || "Untitled form");
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { title?: string; status?: FormStatus },
  ) {
    return this.forms.update(user, id, body || {});
  }

  @Put(":id/schema")
  saveSchema(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.forms.saveSchema(user, id, body);
  }

  @Get(":id/responses")
  responses(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("q") q?: string,
  ) {
    return this.forms.listResponses(user, id, q);
  }

  @Get(":id/analytics")
  analytics(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.forms.analytics(user, id);
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
