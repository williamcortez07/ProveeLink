import jwt from "jsonwebtoken";
import { env } from "../config/environment.js";

/**
 * Genera un Access Token JWT con datos del usuario.
 * @param {{ id: string, email: string, role_id: string, role_name: string }} payload
 * @returns {string} JWT firmado
 */
export const signAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: "ProveeLink",
    audience: "ProveeLink-Client",
  });
};

/**
 * Genera un Refresh Token JWT de larga duración.
 * @param {{ id: string }} payload
 * @returns {string} JWT firmado
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "7d",
    issuer: "ProveeLink",
    audience: "ProveeLink-Client",
  });
};

/**
 * Verifica y decodifica un JWT.
 * @param {string} token
 * @returns {object} payload decodificado
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: "ProveeLink",
    audience: "ProveeLink-Client",
  });
};
