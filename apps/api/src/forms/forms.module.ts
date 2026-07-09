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

@Module({
  imports: [AuthModule],
  controllers: [
    FormsController,
    PublicController,
    UploadsController,
    AiController,
    AutomationsController,
  ],
  providers: [FormsService, AiService, AutomationsService],
})
export class FormsModule {}
