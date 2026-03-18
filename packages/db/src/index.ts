import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton pattern — reuse connection across hot reloads in Next.js dev
declare global {
  // eslint-disable-next-line no-var
  var __mtwg_pg: ReturnType<typeof postgres> | undefined
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const pg = globalThis.__mtwg_pg ?? postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.__mtwg_pg = pg
}

export const db = drizzle(pg, { schema })

// Re-export schema so consumers can import from @mtwg/db directly
export * from './schema'
export { schema }
