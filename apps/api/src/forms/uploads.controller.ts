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
// Allowlist of safe upload types. Notably excludes SVG/HTML (stored-XSS) and
// any executable/script. Both the browser-declared MIME and the file extension
// must be allowed; served with `nosniff` so nothing can be reinterpreted.
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);
const ALLOWED_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip",
]);

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
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              "That file type isn't allowed. Upload an image, PDF, or document.",
            ),
            false,
          );
        }
      },
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
