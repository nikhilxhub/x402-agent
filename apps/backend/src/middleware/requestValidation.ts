import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

const premiumBody = z.object({
  prompt: z.string().min(1, "Prompt required"),
  model: z.string().min(1, "Model required")
});

export function validatePremiumBody(req: Request, res: Response, next: NextFunction) {
  const parsed = premiumBody.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error as ZodError;
    return res.status(400).json({
      error: error.issues.map((issue) => issue.message).join(", ")
    });
  }
  next();
}
