import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
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

@Module({
  imports: [AuthModule],
  controllers: [
    FormsController,
    PublicController,
    UploadsController,
    AiController,
    AutomationsController,
    SettingsController,
  ],
  providers: [FormsService, AiService, AutomationsService, SettingsService],
})
export class FormsModule {}
