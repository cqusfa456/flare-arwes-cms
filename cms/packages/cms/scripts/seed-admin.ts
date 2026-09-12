import { createDb, users } from '@sci-fi-cms/core'
import { eq } from 'drizzle-orm'
import * as crypto from 'crypto'
import { getPlatformProxy } from 'wrangler'

/**
 * Seed script to create initial admin user
 *
 * Run this script after migrations:
 * npm run db:migrate:local
 * npm run seed
 *
 * Admin credentials come from environment variables:
 *   SCIFI_ADMIN_EMAIL     — admin email (default: admin@arwes.dev)
 *   SCIFI_ADMIN_PASSWORD  — admin password (required, min 8 chars)
 *   SCIFI_ADMIN_USERNAME  — admin username (default: admin)
 */

async function seed() {
  // Get D1 database from Cloudflare environment using wrangler's getPlatformProxy
  const { env, dispose } = await getPlatformProxy()

  if (!env?.DB) {
    console.error('❌ Error: DB binding not found')
    console.error('')
    console.error('Make sure you have:')
    console.error('1. Created your D1 database: wrangler d1 create <database-name>')
    console.error('2. Updated wrangler.toml with the database_id')
    console.error('3. Run migrations: npm run db:migrate:local')
    console.error('')
    process.exit(1)
  }

  const db = createDb(env.DB)

  const email = process.env.SCIFI_ADMIN_EMAIL || 'admin@arwes.dev'
  const username = process.env.SCIFI_ADMIN_USERNAME || 'admin'
  const password = process.env.SCIFI_ADMIN_PASSWORD

  if (!password || password.length < 8) {
    console.error('❌ Error: SCIFI_ADMIN_PASSWORD environment variable is required (min 8 chars)')
    console.error('  Example: SCIFI_ADMIN_PASSWORD=my-secure-password npm run seed')
    process.exit(1)
  }

  try {
    // Check if admin user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get()

    if (existingUser) {
      console.log('✓ Admin user already exists')
      console.log(`  Email: ${email}`)
      console.log(`  Role: ${existingUser.role}`)
      return
    }

    // Hash password using SHA-256 (same as Sci-Fi CMS auth system)
    const salt = crypto.randomBytes(16).toString('hex')
    const data = password + salt
    const passwordHash = crypto.createHash('sha256').update(data).digest('hex')
    const now = Date.now()
    const odid = `admin-${now}-${Math.random().toString(36).substr(2, 9)}`

    // Create admin user
    await db
      .insert(users)
      .values({
        id: odid,
        email: email,
        username: username,
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: passwordHash,
        role: 'admin',
        isActive: true,
        createdAt: now,
        updatedAt: now
      })
      .run()

    console.log('✓ Admin user created successfully')
    console.log(`  Email: ${email}`)
    console.log(`  Role: admin`)
    console.log('')
    console.log('You can now login at: http://localhost:8787/auth/login')
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    await dispose()
    process.exit(1)
  }

  // Clean up the platform proxy
  await dispose()
}

// Run seed
seed()
  .then(() => {
    console.log('')
    console.log('✓ Seeding complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  })
