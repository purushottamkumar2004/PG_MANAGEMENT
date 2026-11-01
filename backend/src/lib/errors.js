// Errors that map to the contract shape: { error: { code, message } }.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const validationError = (message = 'Invalid input') => new AppError(400, 'VALIDATION_ERROR', message);
export const unauthorized = (message = 'Login required') => new AppError(401, 'UNAUTHORIZED', message);
export const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Wrong phone or password');
export const forbidden = (message = 'Not allowed for your role') => new AppError(403, 'FORBIDDEN', message);
export const accountInactive = () => new AppError(403, 'ACCOUNT_INACTIVE', 'This account is switched off');
export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
