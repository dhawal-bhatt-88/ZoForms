import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FormsController } from "./forms.controller";
import { PublicController } from "./public.controller";
import { UploadsController } from "./uploads.controller";
import { FormsService } from "./forms.service";

@Module({
  imports: [AuthModule],
  controllers: [FormsController, PublicController, UploadsController],
  providers: [FormsService],
})
export class FormsModule {}
