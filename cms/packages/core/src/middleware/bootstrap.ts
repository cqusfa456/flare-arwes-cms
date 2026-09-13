import { Context, Hono, Next, Env } from "hono";
import { syncCollections } from "../services/collection-sync";
import { MigrationService } from "../services/migrations";
import { PluginBootstrapService } from "../services/plugin-bootstrap";
import type { SciFiConfig } from "../app";

type Bindings = {
  DB: D1Database;
  KV?: KVNamespace;
  CACHE_KV?: KVNamespace;
};

// Track if bootstrap has been run in this worker instance
let bootstrapComplete = false;

// KV marker so a cold isolate can skip work a previous isolate already did.
// Without it, a recycled isolate replays migrations, collection sync and plugin
// bootstrap on the first request it serves. The short TTL keeps deploy-time work
// (new migrations, collection edits) converging within minutes instead of being
// skipped for the lifetime of the namespace.
const BOOTSTRAP_MARKER_KEY = "system:bootstrap:completed";
const BOOTSTRAP_MARKER_TTL_SECONDS = 300;

// Module-level app reference — set by createSciFiApp() so PluginManager
// can include it in PluginContext during initialize()
// Typed as Hono<any> to accept any Hono app regardless of env generics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appReference: Hono<any> | undefined;

/**
 * Get the Hono app reference stored during bootstrap.
 * Used by PluginManager to thread app into PluginContext.activate().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAppReference(): Hono<any> | undefined {
  return appReference;
}

/**
 * Bootstrap middleware that ensures system initialization.
 *
 * Runs once per worker instance, and at most once per marker TTL across
 * instances: the KV marker lets a freshly created isolate adopt the work a
 * previous isolate already completed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bootstrapMiddleware(config: SciFiConfig = {}, app?: Hono<any>) {
  // Store app reference at module level so PluginManager can access it
  if (app) {
    appReference = app;
  }
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    // Skip if already bootstrapped in this worker instance
    if (bootstrapComplete) {
      return next();
    }

    // Skip bootstrap for static assets and health checks
    const path = c.req.path;
    if (
      path.startsWith("/images/") ||
      path.startsWith("/assets/") ||
      path === "/health" ||
      path.endsWith(".js") ||
      path.endsWith(".css") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".ico")
    ) {
      return next();
    }

    // Adopt the marker a previous isolate wrote, so a cold start does not
    // replay migrations, collection sync and plugin bootstrap.
    //
    // The marker only proves that the *previous* bootstrap finished. A deployment
    // that brings new migrations still has to apply them, and skipping the whole
    // bootstrap on the marker meant a new migration could ship and never reach the
    // database. Pending migrations are therefore checked before the early return.
    const cache = c.env.CACHE_KV ?? c.env.KV;
    if (cache) {
      try {
        const marker = await cache.get(BOOTSTRAP_MARKER_KEY);
        if (marker) {
          const pending = await new MigrationService(c.env.DB).getMigrationStatus();
          if (pending.pendingMigrations === 0) {
            bootstrapComplete = true;
            return next();
          }
          console.log(
            `[Bootstrap] ${pending.pendingMigrations} pending migration(s) despite the bootstrap marker; running them`
          );
        }
      } catch (error) {
        console.error("[Bootstrap] Error reading bootstrap marker:", error);
      }
    }

    try {
      console.log("[Bootstrap] Starting system initialization...");

      // 1. Run database migrations first
      console.log("[Bootstrap] Running database migrations...");
      const migrationService = new MigrationService(c.env.DB);
      await migrationService.runPendingMigrations();

      // 2. Sync collection configurations
      console.log("[Bootstrap] Syncing collection configurations...");
      try {
        await syncCollections(c.env.DB);
      } catch (error) {
        console.error("[Bootstrap] Error syncing collections:", error);
        // Continue bootstrap even if collection sync fails
      }

      // 3. Bootstrap core plugins (unless disableAll is set)
      if (!config.plugins?.disableAll) {
        console.log("[Bootstrap] Bootstrapping core plugins...");
        const bootstrapService = new PluginBootstrapService(c.env.DB);

        // Check if bootstrap is needed
        const needsBootstrap = await bootstrapService.isBootstrapNeeded();
        if (needsBootstrap) {
          await bootstrapService.bootstrapCorePlugins();
        }
      } else {
        console.log("[Bootstrap] Plugin bootstrap skipped (disableAll is true)");
      }

      // Mark bootstrap as complete for this worker instance...
      bootstrapComplete = true;

      // ...and for future isolates, so a cold start does not replay this work.
      if (cache) {
        try {
          await cache.put(BOOTSTRAP_MARKER_KEY, new Date().toISOString(), {
            expirationTtl: BOOTSTRAP_MARKER_TTL_SECONDS,
          });
        } catch (error) {
          console.error("[Bootstrap] Error writing bootstrap marker:", error);
        }
      }

      console.log("[Bootstrap] System initialization completed");
    } catch (error) {
      console.error("[Bootstrap] Error during system initialization:", error);
      // Don't prevent the app from starting, but log the error
    }

    return next();
  };
}

/**
 * Reset bootstrap flag (useful for testing)
 */
export function resetBootstrap() {
  bootstrapComplete = false;
}
