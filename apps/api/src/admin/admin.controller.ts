import {
  Body,
  Controller,
  createParamDecorator,
  Delete,
  type ExecutionContext,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminGuard, type AdminActor } from "./admin.guard";

const CurrentAdmin = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): AdminActor => ctx.switchToHttp().getRequest().admin,
);

@Controller("v1/admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("orgs")
  listOrgs(@Query("q") q?: string) {
    return this.admin.listOrgs(q);
  }

  @Get("orgs/:id")
  getOrg(@Param("id") id: string) {
    return this.admin.getOrg(id);
  }

  @Patch("orgs/:id")
  updateOrg(
    @CurrentAdmin() actor: AdminActor,
    @Param("id") id: string,
    @Body() body: { status?: string },
  ) {
    return this.admin.updateOrg(actor, id, body || {});
  }

  @Get("users")
  listUsers(@Query("q") q?: string) {
    return this.admin.listUsers(q);
  }

  @Patch("users/:id")
  updateUser(
    @CurrentAdmin() actor: AdminActor,
    @Param("id") id: string,
    @Body() body: { status?: string; isAdmin?: boolean },
  ) {
    return this.admin.updateUser(actor, id, body || {});
  }

  @Delete("users/:id")
  deleteUser(@CurrentAdmin() actor: AdminActor, @Param("id") id: string) {
    return this.admin.deleteUser(actor, id);
  }

  @Post("users/:id/impersonate")
  impersonate(@CurrentAdmin() actor: AdminActor, @Param("id") id: string) {
    return this.admin.impersonate(actor, id);
  }

  @Get("forms")
  listForms(@Query("q") q?: string) {
    return this.admin.listForms(q);
  }

  @Delete("forms/:id")
  deleteForm(@CurrentAdmin() actor: AdminActor, @Param("id") id: string) {
    return this.admin.deleteForm(actor, id);
  }

  @Get("audit")
  audit() {
    return this.admin.listAudit();
  }
}
