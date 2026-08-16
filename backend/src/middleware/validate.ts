import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      status: 'error',
      message: errors.array()[0]?.msg || 'Validation failed',
      errors: errors.array(),
    });
    return;
  }
  next();
}
