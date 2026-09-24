import * as Linking from 'expo-linking';

import { env } from '@/config/env';
import { SUPPORT_ROUTES } from '@/constants';

import { createLogger } from './logger';

const log = createLogger('support');

/**
 * Support channels.
 *
 * The platform has no automated password reset by design (spec §18), so these
 * links are the actual recovery path for a locked-out student — they need to
 * work even when the app cannot authenticate. Everything here is therefore
 * driven by build-time config rather than an API response.
 */

export interface SupportContext {
  reason: 'password' | 'device' | 'access' | 'payment' | 'general';
  /** Included in the prefilled message so the admin can find the account. */
  phone?: string;
  fullName?: string;
  courseTitle?: string;
}

function composeMessage(ctx: SupportContext): string {
  const lines = ['Support request from the mobile app', `Reason: ${ctx.reason}`];
  if (ctx.fullName) lines.push(`Name: ${ctx.fullName}`);
  if (ctx.phone) lines.push(`Phone: ${ctx.phone}`);
  if (ctx.courseTitle) lines.push(`Course: ${ctx.courseTitle}`);
  lines.push(`App: ${env.appVersion} (${env.env})`);
  return lines.join('\n');
}

/**
 * Opens the link directly instead of asking `canOpenURL` first. On Android 11+
 * `canOpenURL` answers false for `tel:` and `mailto:` unless those schemes are
 * declared in the manifest's <queries>, which would silently disable the only
 * password-recovery channels. `openURL` rejects when nothing can handle the
 * link, which is the signal we actually need.
 */
async function open(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (e) {
    log.warn('failed to open support link', { scheme: url.split(':')[0], e: String(e) });
    return false;
  }
}

export const support = {
  call: () => open(SUPPORT_ROUTES.tel(env.support.phone)),

  whatsapp: (ctx: SupportContext) =>
    open(SUPPORT_ROUTES.whatsapp(env.support.whatsapp, composeMessage(ctx))),

  email: (ctx: SupportContext) =>
    open(
      SUPPORT_ROUTES.mailto(
        env.support.email,
        `Support request — ${ctx.reason}`
      )
    ),

  openSettings: () => Linking.openSettings(),

  /**
   * Store-required public pages. Returns false when the URL has not been
   * configured for this build, so the caller can fall back to support.
   */
  openLegal: async (
    page: 'privacyPolicy' | 'terms' | 'accountDeletion'
  ): Promise<boolean> => {
    const url =
      page === 'privacyPolicy'
        ? env.legal.privacyPolicyUrl
        : page === 'terms'
          ? env.legal.termsUrl
          : env.legal.accountDeletionUrl;
    if (!url) return false;
    return open(url);
  },
};
