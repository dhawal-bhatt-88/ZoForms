import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TemplatesModule } from "../templates/templates.module";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { RendererCore } from "./renderer-core";

@Module({
  imports: [AuthModule, TemplatesModule],
  controllers: [FormsController],
  providers: [FormsService, RendererCore],
})
export class FormsModule {}
