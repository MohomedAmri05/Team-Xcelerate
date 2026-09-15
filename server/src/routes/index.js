import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import rateLimit from 'express-rate-limit';

import {
  auth,
  adminOnly,
  staffOrAdmin,
  customerOnly,
  optionalAuth,
  requirePermission,
  asyncHandler,
  validate
} from '../middleware/core.js';

import * as authController
  from '../controllers/auth.controller.js';

import * as vehicleController
  from '../controllers/vehicle.controller.js';

import * as imageController
  from '../controllers/image.controller.js';

import * as domainController
  from '../controllers/domain.controller.js';

import * as enquiryController
  from '../controllers/enquiry.controller.js';

import * as bookingController
  from '../controllers/booking.controller.js';

import * as responseController
  from '../controllers/response.controller.js';

import * as permissionController
  from '../controllers/permission.controller.js';

import * as profileController
  from '../controllers/profile.controller.js';

import * as wishlistController
  from '../controllers/wishlist.controller.js';

import {
  loginSchema,
  registerSchema,
  vehicleSchema,
  vehicleImageUpdateSchema,
  enquirySchema,
  enquiryUpdateSchema,
  enquiryAssignmentSchema,
  userSchema,
  responseSchema,
  contentSchema,
  financeSchema,
  profileUpdateSchema,
  passwordChangeSchema,
  staffPermissionSchema,
  bookingCreateSchema,
  bookingUpdateSchema,
  bookingAssignmentSchema
} from '../validators/schemas.js';

const router = Router();

const wrap = (controller) => {
  return asyncHandler(controller);
};

/*
|--------------------------------------------------------------------------
| Rate Limiters
|--------------------------------------------------------------------------
*/

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many attempts. Please try again later.',
    errors: []
  }
});

const enquiryLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many enquiries. Please try again later.',
    errors: []
  }
});

/*
|--------------------------------------------------------------------------
| Image Upload Configuration
|--------------------------------------------------------------------------
*/

const allowedImageTypes = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

const storage = multer.diskStorage({
  destination: 'uploads',

  filename: (
    req,
    file,
    callback
  ) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const safeFilename =
      `${crypto.randomUUID()}${extension}`;

    callback(
      null,
      safeFilename
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {
    if (
      !allowedImageTypes.includes(
        file.mimetype
      )
    ) {
      return callback(
        new Error(
          'Only JPEG, PNG and WebP images are allowed'
        )
      );
    }

    return callback(
      null,
      true
    );
  }
});

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/

router.post(
  '/auth/register',
  loginLimit,
  validate(registerSchema),
  wrap(authController.register)
);

router.post(
  '/auth/login',
  loginLimit,
  validate(loginSchema),
  wrap(authController.login)
);

router.post(
  '/auth/refresh',
  wrap(authController.refresh)
);

router.post(
  '/auth/logout',
  auth,
  wrap(authController.logout)
);

router.get(
  '/auth/me',
  auth,
  wrap(authController.me)
);

router.put(
  '/auth/profile',
  auth,
  validate(profileUpdateSchema),
  wrap(profileController.updateProfile)
);

router.put(
  '/auth/change-password',
  auth,
  validate(passwordChangeSchema),
  wrap(profileController.changePassword)
);

/*
|--------------------------------------------------------------------------
| Public Vehicle Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/vehicles',
  optionalAuth,
  wrap(vehicleController.list)
);

router.get(
  '/vehicles/:id',
  optionalAuth,
  wrap(vehicleController.one)
);

/*
|--------------------------------------------------------------------------
| Customer Wishlist Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/wishlist',
  auth,
  customerOnly,
  wrap(
    wishlistController.listWishlist
  )
);

router.get(
  '/wishlist/:vehicleId/check',
  auth,
  customerOnly,
  wrap(
    wishlistController.checkWishlist
  )
);

router.post(
  '/wishlist/:vehicleId',
  auth,
  customerOnly,
  wrap(
    wishlistController.addToWishlist
  )
);

router.delete(
  '/wishlist/:vehicleId',
  auth,
  customerOnly,
  wrap(
    wishlistController.removeFromWishlist
  )
);

/*
|--------------------------------------------------------------------------
| Vehicle Management Routes
|--------------------------------------------------------------------------
*/

router.post(
  '/vehicles',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageInventory'
  ),
  validate(vehicleSchema),
  wrap(vehicleController.create)
);

router.put(
  '/vehicles/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageInventory'
  ),
  validate(vehicleSchema),
  wrap(vehicleController.update)
);

router.patch(
  '/vehicles/:id/status',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageInventory'
  ),
  wrap(vehicleController.status)
);

/*
 * Vehicle deletion currently performs
 * a soft archive.
 */
router.delete(
  '/vehicles/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canArchiveRecords'
  ),
  wrap(vehicleController.remove)
);

/*
|--------------------------------------------------------------------------
| Vehicle Image Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/vehicles/:vehicleId/images',
  wrap(imageController.listImages)
);

router.post(
  '/vehicles/:vehicleId/images',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageInventory'
  ),
  upload.array(
    'images',
    10
  ),
  wrap(imageController.uploadImages)
);

router.patch(
  '/vehicle-images/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageInventory'
  ),
  validate(
    vehicleImageUpdateSchema
  ),
  wrap(imageController.updateImage)
);

/*
 * Image deletion permanently removes
 * the file, so it is restricted to Admin.
 */
router.delete(
  '/vehicle-images/:id',
  auth,
  adminOnly,
  wrap(imageController.deleteImage)
);

/*
|--------------------------------------------------------------------------
| Customer Enquiry Submission
|--------------------------------------------------------------------------
*/

router.post(
  '/enquiries',
  enquiryLimit,
  auth,
  customerOnly,
  validate(enquirySchema),
  wrap(
    enquiryController.createEnquiry
  )
);

/*
|--------------------------------------------------------------------------
| Customer's Own Enquiries
|--------------------------------------------------------------------------
*/

router.get(
  '/my/enquiries',
  auth,
  customerOnly,
  wrap(
    enquiryController.listMyEnquiries
  )
);

router.get(
  '/my/enquiries/:id',
  auth,
  customerOnly,
  wrap(
    enquiryController.getMyEnquiry
  )
);

/*
|--------------------------------------------------------------------------
| Admin and Staff Enquiry Management
|--------------------------------------------------------------------------
*/

router.get(
  '/enquiries',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  requirePermission(
    'canViewAssignedContacts'
  ),
  wrap(
    enquiryController.listEnquiries
  )
);

router.get(
  '/enquiries/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  requirePermission(
    'canViewAssignedContacts'
  ),
  wrap(
    enquiryController.getEnquiry
  )
);

router.patch(
  '/enquiries/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  validate(
    enquiryUpdateSchema
  ),
  wrap(
    enquiryController.updateEnquiry
  )
);

/*
 * Only Admin can assign or reassign
 * an enquiry.
 */
router.patch(
  '/enquiries/:id/assign',
  auth,
  adminOnly,
  validate(
    enquiryAssignmentSchema
  ),
  wrap(
    enquiryController.assignEnquiry
  )
);

/*
 * Enquiry deletion is permanent,
 * so it is restricted to Admin.
 */
router.delete(
  '/enquiries/:id',
  auth,
  adminOnly,
  wrap(
    enquiryController.deleteEnquiry
  )
);

/*
|--------------------------------------------------------------------------
| Enquiry Response Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/enquiries/:enquiryId/responses',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  wrap(
    responseController.listResponses
  )
);

router.post(
  '/enquiries/:enquiryId/responses',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  validate(responseSchema),
  wrap(
    responseController.createResponse
  )
);

router.put(
  '/enquiry-responses/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  validate(responseSchema),
  wrap(
    responseController.updateResponse
  )
);

/*
 * Only Admin can permanently delete
 * a draft response.
 */
router.delete(
  '/enquiry-responses/:id',
  auth,
  adminOnly,
  wrap(
    responseController.deleteResponse
  )
);

router.post(
  '/enquiry-responses/:id/send',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  wrap(
    responseController.sendResponse
  )
);

/*
|--------------------------------------------------------------------------
| Customer Test-Drive Bookings
|--------------------------------------------------------------------------
*/

router.post(
  '/bookings',
  auth,
  customerOnly,
  validate(
    bookingCreateSchema
  ),
  wrap(
    bookingController.createBooking
  )
);

router.get(
  '/my/bookings',
  auth,
  customerOnly,
  wrap(
    bookingController.listMyBookings
  )
);

router.get(
  '/my/bookings/:id',
  auth,
  customerOnly,
  wrap(
    bookingController.getMyBooking
  )
);

router.patch(
  '/my/bookings/:id/cancel',
  auth,
  customerOnly,
  wrap(
    bookingController.cancelMyBooking
  )
);

/*
|--------------------------------------------------------------------------
| Admin and Staff Test-Drive Management
|--------------------------------------------------------------------------
*/

router.get(
  '/bookings',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  requirePermission(
    'canViewAssignedContacts'
  ),
  wrap(
    bookingController.listBookings
  )
);

router.get(
  '/bookings/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  requirePermission(
    'canViewAssignedContacts'
  ),
  wrap(
    bookingController.getBooking
  )
);

router.patch(
  '/bookings/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  validate(
    bookingUpdateSchema
  ),
  wrap(
    bookingController.updateBooking
  )
);

router.patch(
  '/bookings/:id/assign',
  auth,
  adminOnly,
  validate(
    bookingAssignmentSchema
  ),
  wrap(
    bookingController.assignBooking
  )
);

router.delete(
  '/bookings/:id',
  auth,
  adminOnly,
  wrap(
    bookingController.deleteBooking
  )
);

/*
|--------------------------------------------------------------------------
| User Management Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/users',
  auth,
  adminOnly,
  wrap(domainController.listUsers)
);

router.get(
  '/users/:id',
  auth,
  adminOnly,
  wrap(domainController.getUser)
);

router.post(
  '/users',
  auth,
  adminOnly,
  validate(userSchema),
  wrap(domainController.createUser)
);

router.put(
  '/users/:id',
  auth,
  adminOnly,
  validate(userSchema),
  wrap(domainController.updateUser)
);

router.patch(
  '/users/:id/status',
  auth,
  adminOnly,
  wrap(domainController.userStatus)
);

router.delete(
  '/users/:id',
  auth,
  adminOnly,
  wrap(domainController.deleteUser)
);

/*
|--------------------------------------------------------------------------
| Staff Permission Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/users/:id/permissions',
  auth,
  adminOnly,
  wrap(
    permissionController.getPermissions
  )
);

router.put(
  '/users/:id/permissions',
  auth,
  adminOnly,
  validate(
    staffPermissionSchema
  ),
  wrap(
    permissionController.updatePermissions
  )
);

/*
|--------------------------------------------------------------------------
| Session Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/sessions',
  auth,
  wrap(
    domainController.listSessions
  )
);

router.post(
  '/sessions/refresh',
  wrap(authController.refresh)
);

router.delete(
  '/sessions/:id',
  auth,
  wrap(
    domainController.revokeSession
  )
);

router.delete(
  '/sessions',
  auth,
  wrap(
    domainController.revokeAll
  )
);

/*
|--------------------------------------------------------------------------
| Public Company Content Routes
|--------------------------------------------------------------------------
*/

router.get(
  '/content',
  optionalAuth,
  wrap(domainController.listContent)
);

router.get(
  '/content/:slug',

  asyncHandler(
    async (req, res) => {
      const {
        Content
      } = await import(
        '../models/index.js'
      );

      const content =
        await Content.findOne({
          where: {
            sectionSlug:
              req.params.slug,

            isPublished: true
          }
        });

      if (!content) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Content not found',
            errors: []
          });
      }

      return res.json({
        success: true,
        message:
          'Content retrieved',
        data: content,
        meta: {}
      });
    }
  )
);

/*
|--------------------------------------------------------------------------
| Company Content Management
|--------------------------------------------------------------------------
*/

router.post(
  '/content',
  auth,
  adminOnly,
  validate(contentSchema),
  wrap(
    domainController.contents.create
  )
);

router.put(
  '/content/:id',
  auth,
  adminOnly,
  validate(contentSchema),
  wrap(
    domainController.contents.update
  )
);

router.delete(
  '/content/:id',
  auth,
  adminOnly,
  wrap(
    domainController.contents.remove
  )
);

/*
|--------------------------------------------------------------------------
| Public Finance Configuration
|--------------------------------------------------------------------------
*/

router.get(
  '/financing-config/active',

  asyncHandler(
    async (req, res) => {
      const {
        Finance
      } = await import(
        '../models/index.js'
      );

      const configuration =
        await Finance.findOne({
          where: {
            isActive: true
          }
        });

      if (!configuration) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              'No active financing configuration found',

            errors: []
          });
      }

      return res.json({
        success: true,

        message:
          'Active financing configuration retrieved',

        data: configuration,
        meta: {}
      });
    }
  )
);

/*
|--------------------------------------------------------------------------
| Finance Configuration Management
|--------------------------------------------------------------------------
*/

router.get(
  '/financing-config',
  auth,
  adminOnly,
  wrap(
    domainController.finances.list
  )
);

router.post(
  '/financing-config',
  auth,
  adminOnly,
  validate(financeSchema),
  wrap(
    domainController.createFinance
  )
);

router.put(
  '/financing-config/:id',
  auth,
  adminOnly,
  validate(financeSchema),
  wrap(
    domainController.activateFinance
  )
);

router.delete(
  '/financing-config/:id',
  auth,
  adminOnly,
  wrap(
    domainController.deleteFinance
  )
);

export default router;