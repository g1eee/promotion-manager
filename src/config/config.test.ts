import { describe, expect, it } from "vitest";

import { ConfigError, isFeatureEnabled, loadConfig } from "./index";

describe("loadConfig", () => {
  it("applies safe localhost defaults in development", () => {
    const config = loadConfig({ APP_ENV: "development" });

    expect(config.environment).toBe("development");
    expect(config.isProduction).toBe(false);
    expect(config.databaseUrl).toContain("postgresql://");
    expect(config.authSecret).toBeTruthy();
    expect(config.appUrl).toBe("http://localhost:3000");
    expect(config.params.defaultPageSize).toBe(25);
  });

  it("fails fast in production when required secrets are missing", () => {
    let error: unknown;
    try {
      loadConfig({ APP_ENV: "production" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ConfigError);
    const problems = (error as ConfigError).problems;
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DATABASE_URL"),
        expect.stringContaining("NEXTAUTH_SECRET"),
        expect.stringContaining("NEXTAUTH_URL"),
      ]),
    );
  });

  it("loads a complete production configuration", () => {
    const config = loadConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db:5432/pms",
      NEXTAUTH_SECRET: "a-very-long-production-secret-value",
      NEXTAUTH_URL: "https://pms.example.com",
      PMS_FEATURE_FLAGS: "attachments, combined-execution",
      PMS_DEFAULT_PAGE_SIZE: "50",
    });

    expect(config.environment).toBe("production");
    expect(config.isProduction).toBe(true);
    expect(config.params.defaultPageSize).toBe(50);
    expect(isFeatureEnabled(config, "attachments")).toBe(true);
    expect(isFeatureEnabled(config, "combined-execution")).toBe(true);
    expect(isFeatureEnabled(config, "unknown-flag")).toBe(false);
  });

  it("rejects an invalid APP_ENV", () => {
    expect(() => loadConfig({ APP_ENV: "qa" })).toThrowError(ConfigError);
  });

  it("rejects a non-positive page size", () => {
    expect(() =>
      loadConfig({ APP_ENV: "development", PMS_DEFAULT_PAGE_SIZE: "0" }),
    ).toThrowError(ConfigError);
    expect(() =>
      loadConfig({ APP_ENV: "development", PMS_DEFAULT_PAGE_SIZE: "abc" }),
    ).toThrowError(ConfigError);
  });

  it("falls back to development for NODE_ENV=test", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.environment).toBe("development");
  });
});
