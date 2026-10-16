import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { TeamService } from "./team.service";

/** Unauthenticated endpoints backing the public invite-accept page. */
@Controller("v1/invites")
export class InvitesController {
  constructor(private readonly team: TeamService) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.team.getInviteByToken(token);
  }

  /** Sets a password, so it is throttled like the auth credential routes. */
  @Post(":token/accept")
  @UseGuards(ThrottlerGuard)
  accept(
    @Param("token") token: string,
    @Body() body: { password?: string; name?: string },
  ) {
    return this.team.acceptInvite(token, body);
  }
}
