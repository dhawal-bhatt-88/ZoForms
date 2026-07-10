import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { TeamService } from "./team.service";

/** Unauthenticated endpoints backing the public invite-accept page. */
@Controller("v1/invites")
export class InvitesController {
  constructor(private readonly team: TeamService) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.team.getInviteByToken(token);
  }

  @Post(":token/accept")
  accept(
    @Param("token") token: string,
    @Body() body: { password?: string; name?: string },
  ) {
    return this.team.acceptInvite(token, body);
  }
}
