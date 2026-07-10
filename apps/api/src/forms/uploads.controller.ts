import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { env } from "../config/env";

/**
 * Public file uploads for the form runtime.
 *
 * Dev driver = local disk (served statically at /uploads). To move to S3/R2,
 * swap `diskStorage` for storage that streams to the bucket and return the
 * object URL — the runtime contract ({ name, url, size }) is unchanged.
 */
@Controller("v1/public/uploads")
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: join(process.cwd(), "uploads"),
        filename: (_req, file, cb) => {
          const unique =
            Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file provided");
    const base = env.PUBLIC_API_URL;
    return {
      name: file.originalname,
      size: file.size,
      url: `${base}/uploads/${file.filename}`,
    };
  }
}
