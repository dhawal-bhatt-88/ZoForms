import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TemplatesModule } from "../templates/templates.module";
import { FormsController } from "./forms.controller";
import { PublicController } from "./public.controller";
import { UploadsController } from "./uploads.controller";
import { FormsService } from "./forms.service";
import { AiController } from "../ai/ai.controller";
import { AiService } from "../ai/ai.service";
import { AutomationsController } from "../automations/automations.controller";
import { AutomationsService } from "../automations/automations.service";
import { SettingsController } from "../settings/settings.controller";
import { SettingsService } from "../settings/settings.service";
import { RetentionService } from "../settings/retention.service";
import { SearchService } from "../search/search.service";

@Module({
  imports: [AuthModule, TemplatesModule],
  controllers: [
    FormsController,
    PublicController,
    UploadsController,
    AiController,
    AutomationsController,
    SettingsController,
  ],
  providers: [
    FormsService,
    AiService,
    AutomationsService,
    SettingsService,
    RetentionService,
    SearchService,
  ],
})
export class FormsModule {}
