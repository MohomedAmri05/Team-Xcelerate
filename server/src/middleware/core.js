import jwt from 'jsonwebtoken';
import multer from 'multer';
import { ZodError } from 'zod';

import {
  Session,
  StaffPermission,
  User
} from '../models/index.js';

/*
|--------------------------------------------------------------------------
| Successful Response Helper
|--------------------------------------------------------------------------
*/

export const ok = (
  res,
  message,
  data = {},
  meta = {}
) => {
  return res.json({
    success: true,
    message,
    data,
    meta
  });
};

/*
|--------------------------------------------------------------------------
| Async Controller Wrapper
|--------------------------------------------------------------------------
*/

export const asyncHandler = (controller) => {
  return (req, res, next) => {
    Promise
      .resolve(controller(req, res, next))
      .catch(next);
  };
};

/*
|--------------------------------------------------------------------------
| Request Validation
|--------------------------------------------------------------------------
*/

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

export const auth = asyncHandler(
  async (req, res, next) => {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith('Bearer ')
    ) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: []
      });
    }

    const accessToken =
      authorization.slice(7).trim();

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: []
      });
    }

    let payload;

    try {
      payload = jwt.verify(
        accessToken,
        process.env.JWT_ACCESS_SECRET
      );
    } catch {
      return res.status(401).json({
        success: false,
        message:
          'Your session has expired. Please log in again.',
        errors: []
      });
    }

    const session = await Session.findOne({
      where: {
        sessionId: payload.sid,
        userId: payload.sub
      }
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session not found',
        errors: []
      });
    }

    if (session.revokedAt) {
      return res.status(401).json({
        success: false,
        message:
          'This session has been revoked. Please log in again.',
        errors: []
      });
    }

    if (session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message:
          'This session has expired. Please log in again.',
        errors: []
      });
    }

    const user = await User.findByPk(
      payload.sub
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account not found',
        errors: []
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          'This account has been deactivated',
        errors: []
      });
    }

    req.user = user;
    req.session = session;
    req.sessionId = session.sessionId;
    req.permissions = null;

    if (user.role === 'Staff') {
      req.permissions =
        await StaffPermission.findOne({
          where: {
            userId: user.userId
          }
        });
    }

    return next();
  }
);

/*
|--------------------------------------------------------------------------
| Optional Authentication
|--------------------------------------------------------------------------
|
| Requests without a token continue as public requests.
| If a token is supplied, it must be valid and active.
|
*/

export const optionalAuth = (
  req,
  res,
  next
) => {
  const authorization =
    req.headers.authorization;

  if (!authorization) {
    return next();
  }

  return auth(req, res, next);
};

/*
|--------------------------------------------------------------------------
| General Role Authorization
|--------------------------------------------------------------------------
*/

export const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: []
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to access this resource',
        errors: []
      });
    }

    return next();
  };
};

/*
|--------------------------------------------------------------------------
| Common Role Guards
|--------------------------------------------------------------------------
*/

export const adminOnly = allowRoles('Admin');

export const staffOrAdmin = allowRoles(
  'Admin',
  'Staff'
);

export const customerOnly = allowRoles(
  'Customer'
);

/*
|--------------------------------------------------------------------------
| Staff Permission Guard
|--------------------------------------------------------------------------
*/

export const requirePermission = (
  permissionName
) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: []
      });
    }

    /*
     * Admins automatically pass every Staff
     * permission check.
     */
    if (req.user.role === 'Admin') {
      return next();
    }

    if (req.user.role !== 'Staff') {
      return res.status(403).json({
        success: false,
        message:
          'This operation is available only to authorized staff',
        errors: []
      });
    }

    if (!req.permissions) {
      return res.status(403).json({
        success: false,
        message:
          'No Staff permissions are assigned to your account',
        errors: []
      });
    }

    if (!req.permissions[permissionName]) {
      return res.status(403).json({
        success: false,
        message:
          'Your Staff account does not have permission to perform this operation',
        errors: []
      });
    }

    return next();
  };
};

/*
|--------------------------------------------------------------------------
| Not Found Handler
|--------------------------------------------------------------------------
*/

export const notFound = (req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
    errors: []
  });
};

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

export const errors = (
  error,
  req,
  res,
  next
) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  if (error instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',

      errors: error.issues.map((issue) => ({
        field: issue.path
          .slice(1)
          .join('.'),

        message: issue.message
      }))
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(422).json({
        success: false,
        message:
          'Each image must be 5 MB or smaller',
        errors: []
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(422).json({
        success: false,
        message:
          'A maximum of 10 images can be uploaded at once',
        errors: []
      });
    }

    return res.status(422).json({
      success: false,
      message: 'Image upload failed',
      errors: []
    });
  }

  if (
    error.name ===
    'SequelizeUniqueConstraintError'
  ) {
    return res.status(409).json({
      success: false,
      message:
        'A record with this information already exists',
      errors: []
    });
  }

  if (
    error.name ===
    'SequelizeForeignKeyConstraintError'
  ) {
    return res.status(409).json({
      success: false,
      message:
        'This record is connected to other records and cannot be removed',
      errors: []
    });
  }

  const status = error.status || 500;

  return res.status(status).json({
    success: false,

    message:
      status === 500
        ? 'Unexpected server error'
        : error.message,

    errors: []
  });
};