import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { TeamService } from "./team.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("v1/team")
@UseGuards(AuthGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get("members")
  members(@CurrentUser() user: AuthUser) {
    return this.team.members(user);
  }

  @Patch("members/:userId")
  setRole(
    @CurrentUser() user: AuthUser,
    @Param("userId") userId: string,
    @Body() body: { role: string },
  ) {
    return this.team.setRole(user, userId, body?.role);
  }

  @Delete("members/:userId")
  removeMember(@CurrentUser() user: AuthUser, @Param("userId") userId: string) {
    return this.team.removeMember(user, userId);
  }

  @Get("invites")
  invites(@CurrentUser() user: AuthUser) {
    return this.team.listInvites(user);
  }

  @Post("invites")
  invite(
    @CurrentUser() user: AuthUser,
    @Body() body: { email?: string; role?: string },
  ) {
    return this.team.createInvite(user, body);
  }

  @Delete("invites/:id")
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.team.revokeInvite(user, id);
  }
}
