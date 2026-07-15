export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_LENGTH_MESSAGE =
  "A senha deve conter no mínimo 8 caracteres.";
export const PASSWORD_MISMATCH_MESSAGE = "As senhas não coincidem.";

export function validatePassword(password: string): string | null {
  return password.length >= PASSWORD_MIN_LENGTH
    ? null
    : PASSWORD_MIN_LENGTH_MESSAGE;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string
): string | null {
  return password === confirmation ? null : PASSWORD_MISMATCH_MESSAGE;
}
