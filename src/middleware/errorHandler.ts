import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(err);

  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    err.type === "entity.too.large"
  ) {
    return res.status(400).json({
      error: "Request body too large",
    });
  }

  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    err.type === "entity.parse.failed"
  ) {
    return res.status(400).json({
      error: "Malformed JSON body",
    });
  }

  return res.status(500).json({
    error: "Internal Server Error",
  });
}
