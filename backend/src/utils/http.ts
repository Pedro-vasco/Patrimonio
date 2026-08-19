import { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  statusCode: number;

  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const asyncHandler =
  (
    handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
  ) =>
  (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export const getPagination = (query: Request['query']) => {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.pageSize ?? '10'), 10) || 10),
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
};
