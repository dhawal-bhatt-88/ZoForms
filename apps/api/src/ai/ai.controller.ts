import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { FormsService } from "../forms/forms.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("v1/ai")
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly forms: FormsService,
  ) {}

  @Post("generate-form")
  async generate(@CurrentUser() user: AuthUser, @Body() body: { prompt?: string }) {
    const schema = await this.ai.generateSchema(body?.prompt || "");
    return this.forms.createWithSchema(user, schema);
  }
}
