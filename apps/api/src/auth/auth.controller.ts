import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentUser, type AuthUser } from "./current-user.decorator";

@Controller("v1/auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("signup")
  signup(@Body() body: { email: string; password: string; name?: string }) {
    return this.auth.signup(body?.email, body?.password, body?.name);
  }

  @Post("login")
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body?.email, body?.password);
  }

  @Post("google")
  google(@Body() body: { credential: string }) {
    return this.auth.loginWithGoogle(body?.credential);
  }

  @Post("forgot-password")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body?.email);
  }

  @Post("reset-password")
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body?.token, body?.password);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post("verify-email")
  verifyEmail(@Body() body: { token: string }) {
    return this.auth.verifyEmail(body?.token);
  }

  @Post("resend-verification")
  @UseGuards(AuthGuard)
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.sub);
  }
}
