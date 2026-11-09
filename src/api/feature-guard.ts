import { ApiError } from './errors';

/**
 * Refuses a request this release does not allow, before it leaves the device.
 *
 * Hiding the buttons is the first layer and the route layouts are the second.
 * This is the last: a screen that somehow still calls a purchase or redemption
 * mutation gets a normal error and no request reaches the server.
 */
export function assertFeatureEnabled(enabled: boolean, feature: string): void {
  if (enabled) return;
  throw new ApiError({
    code: 'FORBIDDEN',
    status: 403,
    message: `${feature} is not available in this release`,
  });
}
