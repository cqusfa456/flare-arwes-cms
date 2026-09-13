import lerna from '../../../../lerna.json'
import { DEPLOY_TIME } from '../dynamics'

export const settings = Object.freeze({
  title: 'ARWES',
  description: 'Futuristic Sci-Fi UI Web Framework',
  background: 'hsl(180, 20%, 4%)',
  version: lerna.version,
  deployTime: DEPLOY_TIME,
  apps: {
    // The Playground and Performance apps are separate deployments, not routes
    // of this site. An unset URL hides the header entry instead of linking to a
    // path this site does not serve (which 404s); set PUBLIC_APP_PLAY_URL /
    // PUBLIC_APP_PERF_URL at build time to show them.
    play: {
      url: import.meta.env.PUBLIC_APP_PLAY_URL || undefined
    },
    perf: {
      url: import.meta.env.PUBLIC_APP_PERF_URL || undefined
    }
  }
} as const)
