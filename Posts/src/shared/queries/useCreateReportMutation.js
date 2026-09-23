import { useMutation } from '@tanstack/react-query';
import { createReport } from '../services/api';

// No cache invalidation needed — reporting content doesn't change what
// this client sees; the reported item stays visible until a moderator
// acts on it via the admin queue.
export function useCreateReportMutation() {
  return useMutation({
    mutationFn: ({ targetType, targetId, userId, reason }) =>
      createReport(targetType, targetId, userId, reason),
  });
}