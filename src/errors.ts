export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends HttpError {
  constructor(details: string[]) {
    super(400, 'Validation failed', details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}
