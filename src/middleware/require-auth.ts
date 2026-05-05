import type { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const issuer = env.ZITADEL_ISSUER.replace(/\/$/, "");
const jwks = createRemoteJWKSet(new URL(`${issuer}/oauth/v2/keys`));

export interface AuthenticatedRequest extends Request {
  auth?: { sub: string; email?: string; name?: string };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  // Bypass for dev
  if (process.env.DISABLE_AUTH === "1") {
    req.auth = { sub: "dev", email: "dev@local" };
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Bearer token" });
    return;
  }

  const token = header.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ZITADEL_AUDIENCE,
    });
    req.auth = {
      sub: payload.sub as string,
      email: (payload as any).email,
      name: (payload as any).name,
    };
    next();
  } catch (err: any) {
    logger.warn({ err: err.message }, "JWT inválido");
    res.status(401).json({ error: "Invalid token" });
  }
}
