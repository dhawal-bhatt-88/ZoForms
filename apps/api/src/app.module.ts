import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { FormsModule } from "./forms/forms.module";
import { AdminModule } from "./admin/admin.module";
import { TeamModule } from "./team/team.module";
import { DomainsModule } from "./domains/domains.module";
import { BillingModule } from "./billing/billing.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AuthModule,
    FormsModule,
    AdminModule,
    TeamModule,
    DomainsModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
