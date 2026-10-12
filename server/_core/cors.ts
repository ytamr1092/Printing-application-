import type { RequestHandler } from "express";

const DEFAULT_DEV_PORT = 8081;
const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const CORS_HEADERS =
  "Accept, Authorization, Content-Type, Origin, X-Requested-With, X-TRPC-Source, trpc-accept";

function normalizeConfiguredOrigin(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeRequestOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getAllowedCorsOrigins(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const configuredOrigins = [
    ...(env.CORS_ALLOWED_ORIGINS ?? "").split(","),
    env.EXPO_WEB_PREVIEW_URL ?? "",
    env.EXPO_PACKAGER_PROXY_URL ?? "",
  ];
  const origins = new Set<string>();

  for (const value of configuredOrigins) {
    const normalized = normalizeConfiguredOrigin(value);
    if (normalized) origins.add(normalized);
  }

  if (env.NODE_ENV !== "production") {
    const configuredPort = Number.parseInt(env.EXPO_PORT ?? "", 10);
    const devPort =
      Number.isInteger(configuredPort) &&
      configuredPort > 0 &&
      configuredPort <= 65535
        ? configuredPort
        : DEFAULT_DEV_PORT;
    origins.add(`http://localhost:${devPort}`);
    origins.add(`http://127.0.0.1:${devPort}`);
  }

  return origins;
}

export function isAllowedCorsOrigin(
  origin: string,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  const normalized = normalizeRequestOrigin(origin);
  return normalized !== null && allowedOrigins.has(normalized);
}

export function createCorsMiddleware(
  env: NodeJS.ProcessEnv = process.env,
): RequestHandler {
  const allowedOrigins = getAllowedCorsOrigins(env);

  return (req, res, next) => {
    const origin = req.headers.origin;
    res.vary("Origin");

    if (origin) {
      if (!isAllowedCorsOrigin(origin, allowedOrigins)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
      }

      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader("Access-Control-Allow-Methods", CORS_METHODS);
    res.setHeader("Access-Control-Allow-Headers", CORS_HEADERS);
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  };
}
