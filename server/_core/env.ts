type AppIdEnvironment = Record<string, string | undefined>;

export function getAppId(env: AppIdEnvironment = process.env): string {
  return env.EXPO_PUBLIC_APP_ID || env.VITE_APP_ID || "";
}

export const ENV = {
  appId: getAppId(),
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

export const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * Returns the session-signing secret or throws when it is missing/weak.
 * An empty secret must never be used to sign or verify session tokens.
 */
export function requireSessionSecret(
  secret: string,
  isProduction: boolean,
): string {
  if (!secret.trim()) {
    throw new Error("JWT_SECRET is not configured");
  }
  if (isProduction && secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters in production`,
    );
  }
  return secret;
}
