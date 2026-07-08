import { Body, Controller, Get, Param, Post } from "@nestjs/common";
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
}
