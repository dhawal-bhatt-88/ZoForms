import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("v1/settings")
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settings.get(user);
  }

  @Put()
  update(
    @CurrentUser() user: AuthUser,
    @Body() body: { anthropicApiKey?: string | null; aiModel?: string | null },
  ) {
    return this.settings.update(user, body);
  }

  @Post("test-ai")
  testAi(@CurrentUser() user: AuthUser) {
    return this.settings.testAnthropic(user);
  }

  @Get("org")
  getOrg(@CurrentUser() user: AuthUser) {
    return this.settings.getOrg(user);
  }

  @Put("org")
  updateOrg(
    @CurrentUser() user: AuthUser,
    @Body()
    body: { dataRegion?: string; retentionDays?: number; brandingHidden?: boolean },
  ) {
    return this.settings.updateOrg(user, body);
  }

  @Post("org/purge")
  purge(@CurrentUser() user: AuthUser) {
    return this.settings.purgeNow(user);
  }
}
