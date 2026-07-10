import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TeamController } from "./team.controller";
import { InvitesController } from "./invites.controller";
import { TeamService } from "./team.service";

@Module({
  imports: [AuthModule],
  controllers: [TeamController, InvitesController],
  providers: [TeamService],
})
export class TeamModule {}
