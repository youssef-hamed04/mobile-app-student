import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/api/query-keys';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTranslation } from '@/hooks/use-translation';
import { toast } from '@/store/ui-store';

import {
  type PickedImage,
  pickAvatar,
  removeAvatar,
  uploadAvatar,
  validateAvatar,
} from './avatar';

/**
 * Setting or clearing the profile picture.
 *
 * The auth provider holds the canonical `user`, so it is refreshed rather than
 * patched here — the avatar URL the server returns is derived from the object
 * key it chose, and guessing it locally would be inventing a URL.
 *
 * The picker runs inside the mutation rather than before it so that the button
 * shows its pending state for the whole interaction, including the moment
 * between choosing a photo and the upload starting.
 */
export function useChangeAvatar() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const picked = await pickAvatar();

      if (!picked.ok) {
        // Both outcomes end the flow; only one of them is worth a message.
        if (picked.reason === 'denied') {
          toast.error(t('profile.avatarPermissionDenied'));
        }
        return null;
      }

      const problem = validateAvatar(picked.image);
      if (problem) {
        toast.error(t(`profile.avatar_${problem}`));
        return null;
      }

      return uploadAvatar(picked.image);
    },
    onSuccess: async (user) => {
      // Null means the student backed out — nothing changed, nothing to say.
      if (!user) return;
      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: qk.auth.me() }),
      ]);
      toast.success(t('profile.avatarUpdated'));
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: removeAvatar,
    onSuccess: async () => {
      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: qk.auth.me() }),
      ]);
      toast.success(t('profile.avatarRemoved'));
    },
  });
}

export type { PickedImage };
