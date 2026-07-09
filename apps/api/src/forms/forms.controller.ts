import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { FormStatus } from "@prisma/client";
import { FormsService } from "./forms.service";

@Controller("v1/forms")
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  list() {
    return this.forms.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.forms.get(id);
  }

  @Post()
  create(@Body() body: { title?: string }) {
    return this.forms.create(body?.title?.trim() || "Untitled form");
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { title?: string; status?: FormStatus },
  ) {
    return this.forms.update(id, body || {});
  }

  @Put(":id/schema")
  saveSchema(@Param("id") id: string, @Body() body: unknown) {
    return this.forms.saveSchema(id, body);
  }

  @Get(":id/responses")
  responses(@Param("id") id: string) {
    return this.forms.listResponses(id);
  }
}
