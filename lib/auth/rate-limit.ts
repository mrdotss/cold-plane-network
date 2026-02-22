import "server-only";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

// Store maps for different rate limit strategies
const stores = new Map<string, Map<string, RateLimitEntry>>();

// Default configuration: 5 attempts per 15 minutes (for login)
const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

// Project creation: 20 per hour per user
const PROJECT_CREATION_CONFIG: RateLimitConfig = {
  maxAttempts: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// Audit logging: 100 per hour per user
const AUDIT_LOGGING_CONFIG: RateLimitConfig = {
  maxAttempts: 100,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// Mapping engine: 10 per hour per user (expensive operation)
const MAPPING_ENGINE_CONFIG: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Generic rate limit checker. Uses in-memory store (suitable for single-process deployments).
 * For distributed systems, consider Redis.
 */
function checkLimit(
  key: string,
  storeKey: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }

  const store = stores.get(storeKey)!;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const newEntry = { count: 1, resetAt: now + config.windowMs };
    store.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt: newEntry.resetAt,
    };
  }

  entry.count++;
  const allowed = entry.count <= config.maxAttempts;

  return {
    allowed,
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit by IP (for authentication endpoints).
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  return checkLimit(ip, "login", DEFAULT_CONFIG);
}

/**
 * Rate limit by user ID (for project creation).
 * Allows 20 projects per hour per user.
 */
export function checkProjectCreationLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  return checkLimit(userId, "project_creation", PROJECT_CREATION_CONFIG);
}

/**
 * Rate limit by user ID (for audit logging).
 * Allows 100 audit events per hour per user.
 */
export function checkAuditLoggingLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  return checkLimit(userId, "audit_logging", AUDIT_LOGGING_CONFIG);
}

/**
 * Rate limit by user ID (for mapping engine).
 * Allows 10 mapping operations per hour per user (expensive operation).
 */
export function checkMappingEngineLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  return checkLimit(userId, "mapping_engine", MAPPING_ENGINE_CONFIG);
}
