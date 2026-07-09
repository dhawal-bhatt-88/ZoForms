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
import { AutomationsService } from "./automations.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

type UpsertBody = {
  name?: string;
  action?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
};

@Controller("v1")
@UseGuards(AuthGuard)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get("forms/:formId/automations")
  list(@CurrentUser() user: AuthUser, @Param("formId") formId: string) {
    return this.automations.listForForm(user, formId);
  }

  @Post("forms/:formId/automations")
  create(
    @CurrentUser() user: AuthUser,
    @Param("formId") formId: string,
    @Body() body: UpsertBody,
  ) {
    return this.automations.create(user, formId, body);
  }

  @Patch("automations/:id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpsertBody,
  ) {
    return this.automations.update(user, id, body);
  }

  @Delete("automations/:id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.automations.remove(user, id);
  }

  @Post("automations/:id/test")
  test(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.automations.test(user, id);
  }
}
