import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentUser, type AuthUser } from "./current-user.decorator";

/*
 * Only the credential routes are throttled (30 a minute per IP and route, the
 * ThrottlerModule default; forgot-password 5). /me and /me/preferences are
 * read and written by every signed-in page, like the rest of the API, so they
 * aren't.
 */
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("signup")
  @UseGuards(ThrottlerGuard)
  signup(@Body() body: { email: string; password: string; name?: string }) {
    return this.auth.signup(body?.email, body?.password, body?.name);
  }

  @Post("login")
  @UseGuards(ThrottlerGuard)
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body?.email, body?.password);
  }

  @Post("google")
  @UseGuards(ThrottlerGuard)
  google(@Body() body: { credential: string }) {
    return this.auth.loginWithGoogle(body?.credential);
  }

  @Post("forgot-password")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body?.email);
  }

  @Post("reset-password")
  @UseGuards(ThrottlerGuard)
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body?.token, body?.password);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Patch("me/preferences")
  @UseGuards(AuthGuard)
  updatePreferences(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.updatePreferences(user, body);
  }

  @Post("verify-email")
  @UseGuards(ThrottlerGuard)
  verifyEmail(@Body() body: { token: string }) {
    return this.auth.verifyEmail(body?.token);
  }

  @Post("resend-verification")
  @UseGuards(ThrottlerGuard, AuthGuard)
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.sub);
  }
}
