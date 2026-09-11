import { getClient, replayIntegration } from '@sentry/vue'

/**
 * Attaches Sentry's Session Replay recorder to the running client.
 *
 * Lives in its own module so that importing it dynamically gives Rollup a
 * split point: Replay is the heaviest integration in the SDK and nothing on
 * the critical path depends on it.
 */
export function startSessionReplay(): void {
  getClient()?.addIntegration(replayIntegration({ maskAllText: true, blockAllMedia: true }))
}
