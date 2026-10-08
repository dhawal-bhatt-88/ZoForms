import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { FormsModule } from "./forms/forms.module";
import { AdminModule } from "./admin/admin.module";
import { TeamModule } from "./team/team.module";
import { DomainsModule } from "./domains/domains.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    // Abuse protection for the sensitive auth endpoints (applied per-controller).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    FormsModule,
    AdminModule,
    TeamModule,
    DomainsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
