import { Endpoints } from '@/api/endpoints';
import { toApiError } from '@/api/errors';

/**
 * The wire contract, pinned where it is cheapest to get wrong.
 *
 * Every path here was read off the NestJS controllers rather than assumed. The
 * cases that follow are the ones where a silent mismatch produces a plausible
 * but wrong screen instead of an obvious failure.
 */

describe('endpoint paths', () => {
  it.each([
    ['courses.parts', Endpoints.courses.parts('c1'), '/courses/c1/parts'],
    ['courseParts.myPurchases', Endpoints.courseParts.myPurchases, '/me/part-purchases'],
    ['codes.validate', Endpoints.codes.validate, '/codes/validate'],
    ['wallet.summary', Endpoints.wallet.summary, '/wallet'],
    ['wallet.transactions', Endpoints.wallet.transactions, '/wallet/transactions'],
    ['wallet.redeem', Endpoints.wallet.redeem, '/wallet/redeem'],
    ['library.materials', Endpoints.library.materials, '/library/materials'],
    ['library.material', Endpoints.library.material('m1'), '/library/materials/m1'],
    ['library.mine', Endpoints.library.mine, '/library/me'],
    ['library.myPurchases', Endpoints.library.myPurchases, '/library/me/purchases'],
    ['library.quote', Endpoints.library.quote, '/library/quote'],
    ['library.purchase', Endpoints.library.purchase, '/library/purchase'],
    ['library.open', Endpoints.library.open('p1'), '/library/parts/p1/open'],
    ['support.tickets', Endpoints.support.tickets, '/support/tickets'],
    ['support.ticket', Endpoints.support.ticket('t1'), '/support/tickets/t1'],
    ['support.reply', Endpoints.support.reply('t1'), '/support/tickets/t1/messages'],
    ['storage.avatarUpload', Endpoints.storage.avatarUpload, '/storage/uploads/avatar'],
    ['profile.avatar', Endpoints.profile.avatar, '/profile/avatar'],
  ])('%s resolves to %s', (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });

  /**
   * The backend has no advertisement module, table or route. Re-adding an ads
   * path would reintroduce a call that 404s in every environment.
   */
  it('has no advertisement endpoint', () => {
    expect(Endpoints).not.toHaveProperty('ads');
    expect(JSON.stringify(Endpoints)).not.toContain('/ads');
  });

  /**
   * A course part is acquired by redeeming a card through the course's own
   * redemption route. If a purchase path ever appears here it will almost
   * certainly have been wired to the wallet, which courses must never touch.
   */
  it('offers no way to buy a course part', () => {
    const paths = JSON.stringify(Endpoints);
    expect(paths).not.toContain('parts/purchase');
    expect(paths).not.toContain('course-parts/buy');
    expect(Endpoints.courseParts).not.toHaveProperty('purchase');
  });
});

describe('error mapping', () => {
  /**
   * These four used to fall through to a status-based guess, which is how a
   * precise refusal became a misleading one. `INSUFFICIENT_CREDIT` is the
   * worst of them: as HTTP 402 it became `PAYMENT_REQUIRED`, a course-purchase
   * code, which in the Library would point the student at a checkout that does
   * not exist.
   */
  it.each([
    ['INSUFFICIENT_CREDIT', 402],
    ['WALLET_LOCKED', 403],
    ['AMOUNT_BELOW_MINIMUM', 422],
    ['CODE_NOT_RECHARGEABLE', 400],
    ['ALREADY_ENROLLED', 409],
    ['STORAGE_UNAVAILABLE', 503],
    ['UPLOAD_FAILED', 400],
  ])('keeps %s rather than guessing from the status', (code, status) => {
    expect(toApiError(status, { code, message: 'x' }).code).toBe(code);
  });

  it('still falls back sensibly for a code it does not know', () => {
    expect(toApiError(409, { code: 'SOMETHING_NEW', message: 'x' }).code).toBe(
      'VALIDATION_ERROR'
    );
    expect(toApiError(500, {}).code).toBe('SERVER_ERROR');
  });

  it('gives every error an i18n key the locales define', () => {
    const error = toApiError(402, { code: 'INSUFFICIENT_CREDIT', message: 'x' });
    expect(error.i18nKey).toBe('errors.INSUFFICIENT_CREDIT');
  });

  /** Storage being briefly unreachable says nothing about the request itself. */
  it('marks storage outages retryable and credit shortfalls not', () => {
    expect(toApiError(503, { code: 'STORAGE_UNAVAILABLE' }).retryable).toBe(true);
    expect(toApiError(402, { code: 'INSUFFICIENT_CREDIT' }).retryable).toBe(false);
  });
});
