import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { BillingService } from "./billing.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("v1/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @UseGuards(AuthGuard)
  summary(@CurrentUser() user: AuthUser) {
    return this.billing.summary(user);
  }

  @Post("checkout")
  @UseGuards(AuthGuard)
  checkout(@CurrentUser() user: AuthUser, @Body() body: { plan: string }) {
    return this.billing.checkout(user, body?.plan);
  }

  @Post("portal")
  @UseGuards(AuthGuard)
  portal(@CurrentUser() user: AuthUser) {
    return this.billing.portal(user);
  }

  // Public — verified by Stripe signature. Needs the raw request body.
  @Post("webhook")
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    return this.billing.handleWebhook(req.rawBody ?? Buffer.from(""), signature);
  }
}
