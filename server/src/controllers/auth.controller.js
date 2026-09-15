import { Session } from '../models/index.js';
import * as authService from '../services/auth.service.js';
import { ok } from '../middleware/core.js';

const getRequestMetadata = (req) => {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null
  };
};

export async function register(req, res) {
  const result = await authService.registerCustomer(
    req.validated.body,
    getRequestMetadata(req)
  );

  return res.status(201).json({
    success: true,
    message: 'Customer account created successfully',
    data: result,
    meta: {}
  });
}

export async function login(req, res) {
  const result = await authService.login(
    req.validated.body.email,
    req.validated.body.password,
    getRequestMetadata(req)
  );

  return ok(
    res,
    'Login successful',
    result
  );
}

export async function refresh(req, res) {
  const result = await authService.refresh(
    req.body.refreshToken,
    getRequestMetadata(req)
  );

  return ok(
    res,
    'Session refreshed',
    result
  );
}

export async function logout(req, res) {
  await Session.update(
    {
      revokedAt: new Date()
    },
    {
      where: {
        sessionId: req.sessionId
      }
    }
  );

  return ok(
    res,
    'Logged out successfully'
  );
}

export async function me(req, res) {
  const safeUser =
    await authService.createSafeUser(
      req.user
    );

  return ok(
    res,
    'Authenticated user retrieved',
    safeUser
  );
}