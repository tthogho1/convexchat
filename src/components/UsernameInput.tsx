import { useState } from 'react';
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  validateUsername,
  sanitizeUsernameInput,
} from '../../convex/validation';

interface UsernameInputProps {
  onSubmit: (username: string, group?: string) => void | Promise<void>;
}

export function UsernameInput({ onSubmit }: UsernameInputProps) {
  const [username, setUsername] = useState('');
  const [group, setGroup] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validationError = validateUsername(username);
  const canSubmit = validationError === null && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (validationError !== null) return;
    const groupValue = group.trim() || undefined;
    try {
      setSubmitting(true);
      await onSubmit(username, groupValue);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg || 'Failed to continue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Show inline errors only after the user has interacted (to avoid yelling
  // at them on first paint when the field is empty).
  const showError = touched && validationError !== null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Welcome to MapChat
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Enter your username to start tracking your location and chatting with others.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              // Strip any disallowed characters (whitespace, non-ASCII, and
              // email-unsafe symbols) as the user types so the field can never
              // hold an invalid value (defense in depth alongside the
              // schema check).
              setUsername(sanitizeUsernameInput(e.target.value));
            }}
            onBlur={() => setTouched(true)}
            placeholder={`Username (${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} chars, ASCII)`}
            className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none
                       dark:bg-slate-700 dark:text-white mb-1
                       ${showError
                         ? 'border-red-500 focus:border-red-600'
                         : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'}`}
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            // Native pattern as a hint for browser autofill/validation; the
            // real check happens in the shared zod schema.
            pattern="[A-Za-z0-9!#$%&'*+/=?^_`{|}~.\-]{6,10}"
            autoFocus
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={showError}
            aria-describedby="username-help"
          />
          <p
            id="username-help"
            className={`text-xs mb-3 min-h-[1.25rem] ${
              showError
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {showError
              ? validationError
              : `${username.length}/${USERNAME_MAX_LENGTH} — letters, digits, and symbols only.`}
          </p>
          <input
            type="text"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Group (optional)"
            className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                     focus:outline-none focus:border-blue-500 dark:bg-slate-700 dark:text-white mb-4"
            maxLength={30}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                     disabled:cursor-not-allowed
                     text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {submitting ? 'Connecting...' : 'Continue'}
          </button>
          {submitError && (
            <p className="text-xs mt-3 text-red-600 dark:text-red-400 break-words">
              {submitError}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
