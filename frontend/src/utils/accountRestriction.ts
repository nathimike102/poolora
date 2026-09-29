/**
 * utils/accountRestriction.ts
 *
 * When the server refuses a request because the account is blocked or was
 * merged into another, the HTTP client reports it here and the navigator
 * swaps the app for the account status screen, where a blocked user can
 * appeal (UC-A05 3a).
 */

export type AccountRestriction = { id: 'ACCOUNT_BLOCKED' | 'ACCOUNT_MERGED'; message: string };

let listener: ((r: AccountRestriction) => void) | null = null;

export function onAccountRestricted(fn: ((r: AccountRestriction) => void) | null): void {
  listener = fn;
}

export function reportAccountRestricted(r: AccountRestriction): void {
  listener?.(r);
}
