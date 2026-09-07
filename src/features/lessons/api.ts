import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type { AttachmentTicket, LessonDetail, WatchProgress } from '@/types/domain';

export const lessonsApi = {
  detail: (id: string, signal?: AbortSignal) =>
    api.get<LessonDetail>(Endpoints.lessons.detail(id), undefined, { signal }),

  /**
   * Resolves a video id to its lesson.
   *
   * The player route is entered with a video id (that is what the lesson
   * screen navigates with) but needs the lesson's title, completion rule and
   * next-lesson pointer. Video ids and lesson ids are unrelated cuids, so the
   * server does the lookup.
   */
  byVideo: (videoId: string, signal?: AbortSignal) =>
    api.get<LessonDetail>(Endpoints.lessons.byVideo(videoId), undefined, { signal }),

  markComplete: (id: string) =>
    api.post<WatchProgress>(Endpoints.lessons.complete(id)),

  /**
   * Protected attachments are fetched through a short-lived ticket exactly
   * like video: no permanent URL is ever handed to the client.
   */
  attachmentTicket: (attachmentId: string) =>
    api.get<AttachmentTicket>(Endpoints.attachments.ticket(attachmentId), undefined, {
      retries: 0,
    }),
};
