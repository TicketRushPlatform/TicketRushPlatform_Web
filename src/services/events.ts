import { events } from '../data/events'
import type { EventItem } from '../types'

export async function fetchEvents(): Promise<EventItem[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 350))
  return events
}
