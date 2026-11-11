import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Endpoints } from '@/api/endpoints';
import { toApiError } from '@/api/errors';
import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';

/**
 * Owner decision D5: in-app account deletion with a 30-day cancellation
 * period. The paths are read off `AccountDeletionController` in edu-backend.
 */
describe('account deletion contract', () => {
  it('requests and cancels on the routes the API serves', () => {
    expect(Endpoints.auth.accountDeletion).toBe('/auth/account-deletion');
    expect(Endpoints.auth.cancelAccountDeletion).toBe('/auth/account-deletion/cancel');
  });

  it('keeps the pending-deletion refusal precise instead of a flat FORBIDDEN', () => {
    // 403 would otherwise fall back to FORBIDDEN and the login screen could not
    // offer "Cancel deletion".
    const error = toApiError(403, { code: 'ACCOUNT_DELETION_PENDING', message: 'scheduled' });
    expect(error.code).toBe('ACCOUNT_DELETION_PENDING');
    expect(error.retryable).toBe(false);
  });

  it('explains the refusal and the way back in both languages', () => {
    expect(en.errors.ACCOUNT_DELETION_PENDING).toMatch(/cancel/i);
    expect(ar.errors.ACCOUNT_DELETION_PENDING).toBeTruthy();
    for (const bundle of [en, ar]) {
      expect(bundle.deleteAccount.cancelAction).toBeTruthy();
      expect(bundle.deleteAccount.scheduledBody).toContain('{{date}}');
      expect(bundle.deleteAccount.processNote).toMatch(/30/);
    }
  });

  it('shows the wallet balance and the neutral settlement note, never a refund promise', () => {
    for (const bundle of [en, ar]) {
      expect(bundle.deleteAccount.walletBalance).toContain('{{amount}}');
      expect(bundle.deleteAccount.confirmBalance).toContain('{{amount}}');
    }
    // Owner decision (2026-10-30, Phase 6 §4.2): a remaining balance is
    // settled with the administration OUTSIDE the application. The app states
    // exactly that — neutrally — and still never uses the word "refund",
    // which would promise an in-app or monetary mechanism the app does not have.
    expect(en.deleteAccount.walletNote).toMatch(/settled with the administration outside the application/i);
    expect(ar.deleteAccount.walletNote).toContain('الإدارة خارج التطبيق');
    expect(JSON.stringify(en.deleteAccount)).not.toMatch(/refund/i);
    expect(JSON.stringify(ar.deleteAccount)).not.toMatch(/يُسترد|استرداد/);
  });

  it('discloses a balance but never makes deletion depend on the wallet (App Store 5.1.1(v))', () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'app', 'settings', 'delete-account.tsx'), 'utf8');
    expect(source).toMatch(/useWallet\(\)/);
    expect(source).toMatch(/deleteAccount\.confirmBalance/);
    // The button waits only while the balance is loading; a failed lookup does not block it.
    expect(source).toMatch(/disabled=\{busy \|\| wallet\.isPending\}/);
    expect(source).not.toMatch(/!wallet\.data/);
    // Consumption-only: the wallet card appears only for a student who holds a balance.
    expect(source).toMatch(/\{releaseFeatures\.wallet \|\| hasBalance \? \(/);
    expect(source).not.toMatch(/hasBalance \|\| wallet\.isError/);
  });

  it('no longer describes deletion as a support ticket', () => {
    expect(JSON.stringify(en.deleteAccount)).not.toMatch(/ticket/i);
    expect(en.deleteAccount).not.toHaveProperty('ticketBody');
    expect(ar.deleteAccount).not.toHaveProperty('ticketBody');
  });
});
