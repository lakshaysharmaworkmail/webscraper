import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  status: string;
  tokenVersion: number;
}

export function generateToken(user: { id: string; email: string; role: string; status: string; tokenVersion?: number }): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    tokenVersion: user.tokenVersion || 0,
  };
  
  return jwt.sign(payload, config.jwt.secret) as string;
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}