import type { Config } from '@netlify/functions'
import { easternNow, runReminders } from '../lib/reminders.mts'

// Goal: 6 PM Eastern. Cron runs in UTC, so fire at both 22:00 UTC (6 PM EDT)
// and 23:00 UTC (6 PM EST) and only do the work in the run where it's 6 PM in New York.
export default async () => {
  const { hour } = easternNow()
  if (hour !== 18) {
    console.log(`Skipping: it's ${hour}:00 in New York`)
    return
  }
  const result = await runReminders(Netlify.env.get('URL') ?? 'https://bourbon-bubbles-hub.netlify.app')
  console.log(JSON.stringify(result))
}

export const config: Config = {
  schedule: '0 22,23 * * *',
}
