import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { FormsModule } from "./forms/forms.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [PrismaModule, FormsModule],
  controllers: [HealthController],
})
export class AppModule {}
