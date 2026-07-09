import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { FormsModule } from "./forms/forms.module";
import { AdminModule } from "./admin/admin.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [PrismaModule, AuthModule, FormsModule, AdminModule],
  controllers: [HealthController],
})
export class AppModule {}
