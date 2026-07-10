import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { FormsService } from "./forms.service";

/** Unauthenticated endpoints used by the public form runtime (/r/[slug]). */
@Controller("v1/public/forms")
export class PublicController {
  constructor(private readonly forms: FormsService) {}

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.forms.getPublicBySlug(slug);
  }

  @Post(":slug/responses")
  submit(
    @Param("slug") slug: string,
    @Body()
    body: {
      data?: Record<string, unknown>;
      sessionId?: string;
      turnstileToken?: string;
    },
  ) {
    return this.forms.submit(slug, body?.data ?? {}, {
      sessionId: body?.sessionId,
      turnstileToken: body?.turnstileToken,
    });
  }

  @Post(":slug/partial")
  partial(
    @Param("slug") slug: string,
    @Body() body: { sessionId?: string; data?: Record<string, unknown> },
  ) {
    return this.forms.savePartial(slug, body?.sessionId ?? "", body?.data ?? {});
  }

  @Post(":slug/events")
  track(
    @Param("slug") slug: string,
    @Body() body: { type?: string; source?: string },
    @Headers("user-agent") ua: string,
  ) {
    return this.forms.track(slug, body?.type || "", body?.source, ua);
  }
}
