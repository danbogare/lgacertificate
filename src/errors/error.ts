export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = "Please wait before requesting a new OTP") {
    super(429, message);
  }
}

export class InvalidCredentialError extends AppError {
  constructor(message: string = "Invalid credentials") {
    super(400, message);
  }
}

export class InvalidOTPError extends AppError {
  constructor() {
    super(400, "Invalid or expired OTP");
  }
}

// A payment provider call failed; the client only ever sees a generic message
export class PaymentProviderError extends AppError {
  constructor() {
    super(500, "an error has occurred");
  }
}
