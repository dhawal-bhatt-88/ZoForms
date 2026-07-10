import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { DomainsService } from "./domains.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("v1/domains")
@UseGuards(AuthGuard)
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.domains.list(user);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() body: { hostname?: string }) {
    return this.domains.add(user, body?.hostname ?? "");
  }

  @Post(":id/verify")
  verify(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.domains.verify(user, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.domains.remove(user, id);
  }
}
