export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MIN_LENGTH_MESSAGE =
  "A senha deve conter no mínimo 8 caracteres.";

export const PASSWORD_MISMATCH_MESSAGE = "As senhas não coincidem.";

type PasswordFieldValidationOptions = {
  requirePassword?: boolean;
  requireConfirmation?: boolean;
};

export function validatePassword(password: string): string | null {
  return password.length >= PASSWORD_MIN_LENGTH
    ? null
    : PASSWORD_MIN_LENGTH_MESSAGE;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  return password === confirmation ? null : PASSWORD_MISMATCH_MESSAGE;
}

export function getPasswordFieldErrors(
  password: string,
  confirmation: string,
  options: PasswordFieldValidationOptions = {},
) {
  const requiresPassword = options.requirePassword ?? true;
  const requiresConfirmation = options.requireConfirmation ?? requiresPassword;

  const passwordError = requiresPassword ? validatePassword(password) : null;
  const confirmationError = requiresConfirmation
    ? validatePasswordConfirmation(password, confirmation)
    : null;

  return {
    password: passwordError,
    confirmation: confirmationError,
    hasErrors: Boolean(passwordError || confirmationError),
  };
}
