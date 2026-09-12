# @sci-fi-cms/core

> Core framework for Sci-Fi CMS - A modern, TypeScript-first headless CMS built for Cloudflare's edge platform.

---

## New to Sci-Fi CMS?

**Visit [flarecms.dev](https://flarecms.dev) for full documentation and guides.**

---

## Features

- **Edge-First**: Runs on Cloudflare Workers for sub-50ms global response times
- **Zero Cold Starts**: V8 isolates provide instant startup
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Plugin System**: Extensible architecture with hooks and middleware
- **Three-Tier Caching**: Memory, KV, and database layers for optimal performance
- **Admin Interface**: Beautiful glass morphism design system
- **Authentication**: JWT-based auth with role-based permissions
- **Content Management**: Dynamic collections with versioning and workflows
- **Media Management**: R2 storage with automatic optimization
- **REST API**: Auto-generated endpoints for all collections

## Installation

```bash
pnpm install @sci-fi-cms/core
```

### Required Peer Dependencies

```bash
pnpm install @cloudflare/workers-types hono drizzle-orm zod
```

## Quick Start

### 1. Create Your Application

```typescript
// src/index.ts
import { createSciFiApp } from '@sci-fi-cms/core'
import type { SciFiConfig } from '@sci-fi-cms/core'

const config: SciFiConfig = {
  collections: {
    directory: './src/collections',
    autoSync: true
  },
  plugins: {
    directory: './src/plugins',
    autoLoad: false
  }
}

export default createSciFiApp(config)
```

### 2. Define Collections

```typescript
// src/collections/blog-posts.collection.ts
import type { CollectionConfig } from '@sci-fi-cms/core'

export default {
  name: 'blog-posts',
  displayName: 'Blog Posts',
  description: 'Manage your blog posts',

  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Title',
        required: true,
        maxLength: 200
      },
      content: {
        type: 'markdown',
        title: 'Content',
        required: true
      },
      publishedAt: {
        type: 'datetime',
        title: 'Published Date'
      },
      status: {
        type: 'select',
        title: 'Status',
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
      }
    },
    required: ['title', 'content']
  }
} satisfies CollectionConfig
```

### 3. Configure Cloudflare Workers

```toml
# wrangler.toml
name = "my-sci-fi-cms-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "my-sci-fi-cms-db"
database_id = "your-database-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "my-sci-fi-cms-media"
```

### 4. Start Development

```bash
# Run migrations
wrangler d1 migrations apply DB --local

# Start dev server
wrangler dev
```

Visit `http://localhost:8787/admin` to access the admin interface.

## Core Exports

### Main Application

```typescript
import { createSciFiApp } from '@sci-fi-cms/core'
import type { SciFiConfig, SciFiApp, Bindings, Variables } from '@sci-fi-cms/core'
```

### Services

```typescript
import {
  loadCollectionConfigs,
  syncCollections,
  MigrationService,
  Logger,
  PluginService
} from '@sci-fi-cms/core'
```

### Middleware

```typescript
import {
  requireAuth,
  requireRole,
  requirePermission,
  loggingMiddleware,
  cacheHeaders,
  securityHeaders
} from '@sci-fi-cms/core'
```

### Types

```typescript
import type {
  CollectionConfig,
  FieldConfig,
  Plugin,
  PluginContext,
  User,
  Content,
  Media
} from '@sci-fi-cms/core'
```

### Subpath Exports

```typescript
import { MigrationService } from '@sci-fi-cms/core/services'
import { requireAuth } from '@sci-fi-cms/core/middleware'
import type { CollectionConfig } from '@sci-fi-cms/core/types'
import { renderForm } from '@sci-fi-cms/core/templates'
import { sanitizeInput } from '@sci-fi-cms/core/utils'
import { HookSystemImpl } from '@sci-fi-cms/core/plugins'
```

## Architecture

```
@sci-fi-cms/core
├── src/
│   ├── app.ts              # Application factory
│   ├── db/                 # Database schemas & utilities
│   │   └── migrations-bundle.ts  # Auto-generated migration bundle
│   ├── services/           # Business logic
│   ├── middleware/         # Request processing
│   ├── routes/             # HTTP handlers
│   ├── templates/          # Admin UI components
│   ├── plugins/            # Plugin system & core plugins
│   ├── types/              # TypeScript definitions
│   └── utils/              # Utility functions
├── migrations/             # Core database migrations (.sql files)
├── scripts/
│   └── generate-migrations.ts  # Migration bundler script
└── dist/                   # Compiled output
```

## Migration System

Sci-Fi CMS uses a **build-time migration bundler** because Cloudflare Workers cannot access the filesystem at runtime. All migration SQL is bundled into TypeScript during the build process.

```
migrations/*.sql → scripts/generate-migrations.ts → src/db/migrations-bundle.ts → dist/
```

## Documentation

- [flarecms.dev](https://flarecms.dev)
- [GitHub](https://github.com/cqusfa456/sci-fi-cms)

## License

MIT - See [LICENSE](./LICENSE) for details.

---

Forked from [SonicJS](https://github.com/Sonicjs-Org/sonicjs). Built for the edge.
