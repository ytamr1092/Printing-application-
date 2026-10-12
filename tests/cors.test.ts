import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  createCorsMiddleware,
  getAllowedCorsOrigins,
  isAllowedCorsOrigin,
} from "../server/_core/cors";

function createResponse() {
  const headers: Record<string, string> = {};
  const response = {
    vary: vi.fn(),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    status: vi.fn(function (this: unknown) {
      return this;
    }),
    json: vi.fn(),
    sendStatus: vi.fn(),
  } as unknown as Response;

  return { response, headers };
}

describe("CORS origin policy", () => {
  it("normalizes configured URLs and allows only exact trusted origins", () => {
    const allowed = getAllowedCorsOrigins({
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS:
        " https://print.example.com/app ,http://localhost:8081 ",
      EXPO_WEB_PREVIEW_URL: "https://preview.example.com/path",
    });

    expect(allowed).toEqual(
      new Set([
        "https://print.example.com",
        "http://localhost:8081",
        "https://preview.example.com",
      ]),
    );
    expect(isAllowedCorsOrigin("https://print.example.com", allowed)).toBe(
      true,
    );
    expect(isAllowedCorsOrigin("https://attacker.example", allowed)).toBe(
      false,
    );
    expect(isAllowedCorsOrigin("null", allowed)).toBe(false);
    expect(isAllowedCorsOrigin("https://print.example.com/path", allowed)).toBe(
      false,
    );
  });

  it("allows the configured local Expo port in development only", () => {
    expect(
      getAllowedCorsOrigins({
        NODE_ENV: "development",
        EXPO_PORT: "19006",
      }).has("http://localhost:19006"),
    ).toBe(true);
    expect(
      getAllowedCorsOrigins({
        NODE_ENV: "development",
        EXPO_PORT: "19006",
      }).has("http://127.0.0.1:19006"),
    ).toBe(true);
    expect(getAllowedCorsOrigins({ NODE_ENV: "production" }).size).toBe(0);
  });

  it("returns credentialed CORS headers for trusted origins", () => {
    const { response, headers } = createResponse();
    const next = vi.fn();

    createCorsMiddleware({
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://print.example.com",
    })(
      {
        method: "GET",
        headers: { origin: "https://print.example.com" },
      } as Request,
      response,
      next,
    );

    expect(headers["access-control-allow-origin"]).toBe(
      "https://print.example.com",
    );
    expect(headers["access-control-allow-credentials"]).toBe("true");
    expect(headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.vary).toHaveBeenCalledWith("Origin");
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects untrusted origins before they reach route handlers", () => {
    const { response } = createResponse();
    const next = vi.fn();

    createCorsMiddleware({ NODE_ENV: "production" })(
      {
        method: "GET",
        headers: { origin: "https://attacker.example" },
      } as Request,
      response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Origin not allowed" });
    expect(next).not.toHaveBeenCalled();
  });

  it("handles preflight requests without credentials for requests lacking an Origin", () => {
    const { response, headers } = createResponse();
    const next = vi.fn();

    createCorsMiddleware({ NODE_ENV: "production" })(
      { method: "OPTIONS", headers: {} } as Request,
      response,
      next,
    );

    expect(response.sendStatus).toHaveBeenCalledWith(204);
    expect(headers["access-control-allow-origin"]).toBeUndefined();
    expect(headers["access-control-allow-credentials"]).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });
});
