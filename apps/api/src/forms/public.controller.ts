import { Body, Controller, Get, Param, Post } from "@nestjs/common";
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
    @Body() body: { data?: Record<string, unknown> },
  ) {
    return this.forms.submit(slug, body?.data ?? {});
  }
}
