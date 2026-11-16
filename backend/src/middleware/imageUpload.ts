import multer from "multer";
import type { RequestHandler } from "express";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
});

// Handles one image uploaded using the FormData field name "image".
export const uploadSingleImage: RequestHandler = (req, res, next) => {
  imageUpload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          success: false,
          message: "The image must not exceed 5 MB.",
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: "The image upload is invalid. Please try again.",
      });
      return;
    }

    if (error) {
      res.status(400).json({
        success: false,
        message: "Unable to process the uploaded image.",
      });
      return;
    }

    next();
  });
};

// Checks both the declared MIME type and the actual file signature.
export function isSupportedImage(file: Express.Multer.File): boolean {
  const buffer = file.buffer;

  if (!buffer || buffer.length < 12) {
    return false;
  }

  const isJpeg =
    file.mimetype === "image/jpeg" &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isPng =
    file.mimetype === "image/png" &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const isWebp =
    file.mimetype === "image/webp" &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
}
