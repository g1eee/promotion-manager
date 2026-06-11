/**
 * Validated application configuration loader (Deployment Readiness, Task 26.1).
 *
 * Reads environment variables once, validates them, and fails FAST when a
 * required variable is missing or invalid — throwing {@link ConfigError} with a
 * complete list of problems rather than letting the app boot in a broken state.
 *
 * The loader is environment-aware (`development` / `staging` / `production`):
 * - In `production` and `staging`, secrets such as `NEXTAUTH_SECRET` and a real
 *   `DATABASE_URL` are REQUIRED.
 * - In `development`, sensible localhost defaults are applied so the app runs
 *   out of the box.
 *
 * Pure and framework-agnostic: it reads from an injected `env` record
 * (defaulting to `process.env`), so tests can exercise every environment and
 * failure mode without mutating the real process environment.
 */

/** The deployment environments the app recognizes. */
export type AppEnvironment = "development" | "staging" | "production";

/** Raised when configuration is missing or invalid (fail-fast). */
export class ConfigError extends Error {
  constructor(
    message: string,
    /** One problem string per offending variable. */
    readonly problems: readonly string[],
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/** The validated, strongly-typed application configuration. */
export interface AppConfig {
  /** Resolved deployment environment. */
  readonly environment: AppEnvironment;
  /** Whether this is a production deployment. */
  readonly isProduction: boolean;
  /** Database connection string (Prisma/Postgres). */
  readonly databaseUrl: string;
  /** Auth secret used to sign/encrypt session tokens. */
  readonly authSecret: string;
  /** Canonical base URL of the app (auth callbacks/redirects). */
  readonly appUrl: string;
  /** Feature flags parsed from `PMS_FEATURE_FLAGS` (comma-separated). */
  readonly featureFlags: ReadonlySet<string>;
  /** Application parameters. */
  readonly params: {
    /** Default page size for paginated listings. */
    readonly defaultPageSize: number;
  };
}

/** A record of environment variables (subset of `process.env`). */
export type EnvRecord = Record<string, string | undefined>;

const VALID_ENVIRONMENTS: readonly AppEnvironment[] = [
  "development",
  "staging",
  "production",
];

const DEV_DEFAULTS = {
  databaseUrl: "postgresql://localhost:5432/pms_dev",
  authSecret: "dev-insecure-secret-change-me",
  appUrl: "http://localhost:3000",
} as const;

function resolveEnvironment(env: EnvRecord, problems: string[]): AppEnvironment {
  const raw = (env.APP_ENV ?? env.NODE_ENV ?? "development").trim();
  if ((VALID_ENVIRONMENTS as string[]).includes(raw)) {
    return raw as AppEnvironment;
  }
  // `NODE_ENV=test` and other values fall back to development semantics, but an
  // explicit invalid APP_ENV is a hard error.
  if (env.APP_ENV !== undefined && env.APP_ENV.trim() !== "") {
    problems.push(
      `APP_ENV "${env.APP_ENV}" is invalid; expected one of ${VALID_ENVIRONMENTS.join(", ")}.`,
    );
  }
  return "development";
}

function requireValue(
  env: EnvRecord,
  key: string,
  fallback: string | undefined,
  required: boolean,
  problems: string[],
): string {
  const raw = env[key]?.trim();
  if (raw !== undefined && raw !== "") {
    return raw;
  }
  if (required) {
    problems.push(`${key} is required but was not set.`);
    return "";
  }
  return fallback ?? "";
}

function parseFeatureFlags(env: EnvRecord): Set<string> {
  const raw = env.PMS_FEATURE_FLAGS?.trim();
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((flag) => flag.trim())
      .filter((flag) => flag !== ""),
  );
}

function parsePageSize(env: EnvRecord, problems: string[]): number {
  const raw = env.PMS_DEFAULT_PAGE_SIZE?.trim();
  if (!raw) {
    return 25;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    problems.push(
      `PMS_DEFAULT_PAGE_SIZE "${raw}" is invalid; expected a positive integer.`,
    );
    return 25;
  }
  return value;
}

/**
 * Load and validate configuration from the given environment (defaults to
 * `process.env`). Throws {@link ConfigError} listing every problem when any
 * required variable is missing or invalid (fail-fast).
 *
 * @param env Environment variables to read (injectable for tests).
 * @returns The validated {@link AppConfig}.
 */
export function loadConfig(env: EnvRecord = process.env): AppConfig {
  const problems: string[] = [];
  const environment = resolveEnvironment(env, problems);
  const requireSecrets = environment === "production" || environment === "staging";

  const databaseUrl = requireValue(
    env,
    "DATABASE_URL",
    DEV_DEFAULTS.databaseUrl,
    requireSecrets,
    problems,
  );
  const authSecret = requireValue(
    env,
    "NEXTAUTH_SECRET",
    DEV_DEFAULTS.authSecret,
    requireSecrets,
    problems,
  );
  const appUrl = requireValue(
    env,
    "NEXTAUTH_URL",
    DEV_DEFAULTS.appUrl,
    requireSecrets,
    problems,
  );
  const defaultPageSize = parsePageSize(env, problems);
  const featureFlags = parseFeatureFlags(env);

  if (problems.length > 0) {
    throw new ConfigError(
      `Invalid configuration for environment "${environment}": ${problems.length} problem(s).`,
      problems,
    );
  }

  return {
    environment,
    isProduction: environment === "production",
    databaseUrl,
    authSecret,
    appUrl,
    featureFlags,
    params: {
      defaultPageSize,
    },
  };
}

/** True when a feature flag is enabled in the given config. */
export function isFeatureEnabled(config: AppConfig, flag: string): boolean {
  return config.featureFlags.has(flag);
}
