import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TemplatesController } from "./templates.controller";
import { TemplatesSeeder } from "./templates.seeder";
import { TemplatesService } from "./templates.service";

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesSeeder],
  exports: [TemplatesService],
})
export class TemplatesModule {}
