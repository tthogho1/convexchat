import { z } from 'zod';

/**
 * Shared validation schemas used by BOTH the React client and the Convex
 * server. Keeping the rules in one place guarantees that the UI and the
 * mutation enforce exactly the same constraints.
 *
 * Username rules:
 * - 6 to 10 characters
 * - ASCII letters, digits, and symbols valid in the local-part of an email
 *   address (RFC 5322 unquoted form):
 *     ! # $ % & ' * + - / = ? ^ _ ` { | } ~ .
 *   Disallowed (require quoting in email):
 *     space  "  (  )  ,  :  ;  <  >  @  [  \  ]
 */
export const USERNAME_MIN_LENGTH = 6;
export const USERNAME_MAX_LENGTH = 10;

// Single regex used for both schema validation and runtime sanitization.
export const USERNAME_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.\-]+$/;
// Inverse character class for stripping disallowed characters from raw input.
export const USERNAME_DISALLOWED_CHAR_GLOBAL =
  /[^A-Za-z0-9!#$%&'*+/=?^_`{|}~.\-]/g;

export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH, {
    message: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
  })
  .max(USERNAME_MAX_LENGTH, {
    message: `Username must be at most ${USERNAME_MAX_LENGTH} characters.`,
  })
  .regex(USERNAME_PATTERN, {
    message: 'Only letters, digits, and email-safe symbols are allowed.',
  });

export type Username = z.infer<typeof usernameSchema>;

/**
 * Validate a username and return the first error message, or `null` if the
 * value is acceptable. Convenient for inline form rendering.
 */
export function validateUsername(value: string): string | null {
  const result = usernameSchema.safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? 'Invalid username.';
}

/**
 * Strip any character that wouldn't be allowed in a username. Used by the
 * input field's `onChange` so the field can never even hold an invalid
 * value.
 */
export function sanitizeUsernameInput(raw: string): string {
  return raw.replace(USERNAME_DISALLOWED_CHAR_GLOBAL, '');
}
