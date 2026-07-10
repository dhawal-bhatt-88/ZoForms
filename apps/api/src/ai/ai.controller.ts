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

  @Post("edit-form")
  async edit(
    @CurrentUser() user: AuthUser,
    @Body() body: { schema: unknown; instruction?: string },
  ) {
    const cfg = await this.settings.resolveAnthropic(user.orgId);
    return this.ai.editSchema(body?.schema, body?.instruction || "", cfg);
  }

  @Post("suggest-logic")
  async suggestLogic(@CurrentUser() user: AuthUser, @Body() body: { schema: unknown }) {
    const cfg = await this.settings.resolveAnthropic(user.orgId);
    return this.ai.suggestLogic(body?.schema, cfg);
  }

  @Post("summarize-responses")
  async summarize(@CurrentUser() user: AuthUser, @Body() body: { formId: string }) {
    const cfg = await this.settings.resolveAnthropic(user.orgId);
    const form = await this.forms.get(user, body?.formId);
    const responses = await this.forms.listResponses(user, body?.formId);
    return this.ai.summarizeResponses(form.versions[0]?.schema, responses, cfg);
  }

  @Post("responses-copilot")
  async copilot(
    @CurrentUser() user: AuthUser,
    @Body() body: { formId: string; question?: string },
  ) {
    const cfg = await this.settings.resolveAnthropic(user.orgId);
    const form = await this.forms.get(user, body?.formId);
    const responses = await this.forms.listResponses(user, body?.formId);
    return this.ai.answerCopilot(
      form.versions[0]?.schema,
      responses,
      body?.question || "",
      cfg,
    );
  }

  @Post("translate-form")
  async translate(
    @CurrentUser() user: AuthUser,
    @Body() body: { schema: unknown; targetLang?: string },
  ) {
    const cfg = await this.settings.resolveAnthropic(user.orgId);
    return this.ai.translateForm(body?.schema, body?.targetLang || "", cfg);
  }
}
