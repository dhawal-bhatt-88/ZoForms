import { Module } from "@nestjs/common";
import { FormsController } from "./forms.controller";
import { PublicController } from "./public.controller";
import { FormsService } from "./forms.service";

@Module({
  controllers: [FormsController, PublicController],
  providers: [FormsService],
})
export class FormsModule {}
