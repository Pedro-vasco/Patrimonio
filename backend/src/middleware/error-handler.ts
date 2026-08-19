import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { ApiError } from '../utils/http';

export const notFoundHandler = (_request: Request, response: Response) => {
  response.status(404).json({
    message: 'Route not found.',
  });
};

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: 'Validation failed.',
      issues: error.flatten(),
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    message: 'Internal server error.',
  });
};
