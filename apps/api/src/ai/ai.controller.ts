import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { FormsService } from "../forms/forms.service";
import { SettingsService } from "../settings/settings.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("v1/ai")
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly forms: FormsService,
    private readonly settings: SettingsService,
  ) {}

  @Post("generate-form")
  async generate(@CurrentUser() user: AuthUser, @Body() body: { prompt?: string }) {
    const cfg = await this.settings.resolveAnthropic(user.orgId);
    const schema = await this.ai.generateSchema(body?.prompt || "", cfg);
    return this.forms.createWithSchema(user, schema);
  }
}
