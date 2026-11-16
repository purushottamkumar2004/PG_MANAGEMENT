// Errors that map to the contract shape: { error: { code, message } }.
export class AppError extends Error {
  /** `extra` holds additional contract fields for the error body, e.g. { attempts_left: 1 }. */
  constructor(status, code, message, extra = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const validationError = (message = 'Invalid input') => new AppError(400, 'VALIDATION_ERROR', message);
export const unauthorized = (message = 'Login required') => new AppError(401, 'UNAUTHORIZED', message);
export const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Wrong phone or password');
export const forbidden = (message = 'Not allowed for your role') => new AppError(403, 'FORBIDDEN', message);
export const accountInactive = () => new AppError(403, 'ACCOUNT_INACTIVE', 'This account is switched off');
export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);

// Season password (T-06). attempts_left is part of the contract body where the table says so.
export const seasonCodeNotSet = () => new AppError(409, 'SEASON_CODE_NOT_SET', 'Owner has not set a season password yet');
export const seasonCodeWrong = (attemptsLeft) =>
  new AppError(403, 'SEASON_CODE_WRONG', 'Wrong season password', { attempts_left: attemptsLeft });
export const managerLocked = (attemptsLeft = undefined) => new AppError(
  423, 'MANAGER_LOCKED', 'Locked after 3 wrong tries. Ask the owner to unlock.',
  attemptsLeft === undefined ? undefined : { attempts_left: attemptsLeft },
);
