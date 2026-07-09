import { Module } from "@nestjs/common";
import { FormsController } from "./forms.controller";
import { PublicController } from "./public.controller";
import { UploadsController } from "./uploads.controller";
import { FormsService } from "./forms.service";

@Module({
  controllers: [FormsController, PublicController, UploadsController],
  providers: [FormsService],
})
export class FormsModule {}
