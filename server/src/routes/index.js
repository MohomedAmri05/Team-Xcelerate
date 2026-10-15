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

import * as complaintController
  from '../controllers/complaint.controller.js';

import * as documentController
  from '../controllers/document.controller.js';

import * as reportController
  from '../controllers/report.controller.js';

import * as dashboardController
  from '../controllers/dashboard.controller.js';

import * as emailController
  from '../controllers/email.controller.js';

// VIVA – Naaziq – Reply Templates (CRUD resource 4)
import * as replyTemplateController
  from '../controllers/replyTemplate.controller.js';

// VIVA – Herathge – Finance Applications (CRUD resource 3)
import * as financeApplicationController
  from '../controllers/financeApplication.controller.js';

import {
  MAX_DOCUMENT_BYTES
} from '../services/file.service.js';

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
  bookingAssignmentSchema,
  bookingRescheduleSchema,
  complaintCreateSchema,
  complaintMessageSchema,
  complaintReopenSchema,
  complaintUpdateSchema,
  complaintAssignSchema,
  documentUpdateSchema,
  savedReportSchema,
  wishlistNoteSchema,
  staffPermissionCreateSchema,
  replyTemplateSchema,
  financeApplicationCreateSchema,
  financeApplicationCustomerUpdateSchema,
  financeApplicationReviewSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  bulkUsersSchema,
  bulkDeleteStaffSchema,
  staffLeaveSchema
} from '../validators/schemas.js';

const router = Router();

/*
 * Every ":id"-style URL parameter must be a positive whole number.
 * Anything else (e.g. "/enquiries/undefined") gets a clean 404 instead of
 * reaching the database and causing a server error.
 */
for (const name of ['id', 'vehicleId', 'enquiryId']) {
  router.param(name, (req, res, next, value) => {
    if (!/^[1-9][0-9]{0,9}$/.test(String(value))) {
      return res.status(404).json({ success: false, message: 'Record not found', errors: [] });
    }

    return next();
  });
}

/*
 * Private document uploads are held in memory (max MAX_DOCUMENT_BYTES),
 * validated by content and only then written to private storage.
 */
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_BYTES,
    files: 1,
    fields: 10
  }
});

const markDocumentUpload = (req, res, next) => {
  req.uploadKind = 'document';
  next();
};

const complaintLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many complaints submitted. Please try again later.',
    errors: []
  }
});

const inboundLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

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

// VIVA – Ahamed – "Forgot password?" requests per client.
const passwordResetLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many password reset requests. Please try again later.',
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
        Object.assign(
          new Error(
            'Only JPEG, PNG and WebP images are allowed'
          ),
          {
            status: 415
          }
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

// VIVA – Ahamed – Forgot password: the account owner resets it by email
router.post(
  '/auth/forgot-password',
  passwordResetLimit,
  validate(forgotPasswordSchema),
  wrap(authController.forgotPassword)
);

router.post(
  '/auth/reset-password',
  passwordResetLimit,
  validate(resetPasswordSchema),
  wrap(authController.resetPassword)
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

// VIVA – Amri – Wishlists: UPDATE (edit the private note)
router.patch(
  '/wishlist/:vehicleId',
  auth,
  customerOnly,
  validate(wishlistNoteSchema),
  wrap(
    wishlistController.updateWishlistNote
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

router.patch(
  '/vehicles/:id/restore',
  auth,
  staffOrAdmin,
  requirePermission(
    'canArchiveRecords'
  ),
  wrap(vehicleController.restore)
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

router.get(
  '/enquiries/:id/inbound',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageEnquiries'
  ),
  wrap(
    enquiryController.listEnquiryInbound
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

router.patch(
  '/my/bookings/:id',
  auth,
  customerOnly,
  validate(
    bookingRescheduleSchema
  ),
  wrap(
    bookingController.rescheduleMyBooking
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
    'canManageBookings'
  ),
  requirePermission(
    'canViewAssignedContacts'
  ),
  wrap(
    bookingController.listBookings
  )
);

// VIVA – Amri – staff availability for the "Assigned staff" drop-down
router.get(
  '/bookings/staff-availability',
  auth,
  adminOnly,
  wrap(bookingController.bookingStaffAvailability)
);

router.get(
  '/staff-availability',
  auth,
  adminOnly,
  wrap(bookingController.staffDayAvailability)
);

router.get(
  '/staff-leave',
  auth,
  adminOnly,
  wrap(bookingController.listStaffLeave)
);

router.post(
  '/staff-leave',
  auth,
  adminOnly,
  validate(staffLeaveSchema),
  wrap(bookingController.createStaffLeave)
);

router.delete(
  '/staff-leave/:id',
  auth,
  adminOnly,
  wrap(bookingController.deleteStaffLeave)
);

router.get(
  '/bookings/:id',
  auth,
  staffOrAdmin,
  requirePermission(
    'canManageBookings'
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
    'canManageBookings'
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

// VIVA – Ahamed – Users: detail panel, unlock, bulk activate/deactivate
router.get(
  '/users/:id/overview',
  auth,
  adminOnly,
  wrap(domainController.userOverview)
);

router.patch(
  '/users/:id/unlock',
  auth,
  adminOnly,
  wrap(domainController.unlockUser)
);

router.post(
  '/users/bulk',
  auth,
  adminOnly,
  validate(bulkUsersSchema),
  wrap(domainController.bulkUsers)
);

// VIVA – Ahamed – "Delete staff": permanent delete, one or several (Staff only)
router.post(
  '/users/bulk-delete',
  auth,
  adminOnly,
  validate(bulkDeleteStaffSchema),
  wrap(domainController.bulkDeleteStaff)
);

router.delete(
  '/users/:id/permanent',
  auth,
  adminOnly,
  wrap(domainController.deleteStaffPermanently)
);

// VIVA – Ahamed – every Staff member with their permissions (filters, matrix)
router.get(
  '/staff-permissions',
  auth,
  adminOnly,
  wrap(permissionController.listStaffPermissions)
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

// VIVA – Ahamed – Staff Permissions: CREATE
router.post(
  '/users/:id/permissions',
  auth,
  adminOnly,
  validate(staffPermissionCreateSchema),
  wrap(permissionController.createPermissions)
);

// VIVA – Ahamed – Staff Permissions: "Reset" (every permission back to no access)
router.patch(
  '/users/:id/permissions/reset',
  auth,
  adminOnly,
  wrap(permissionController.resetPermissions)
);

// VIVA – Ahamed – Staff Permissions: DELETE ("Remove all access")
router.delete(
  '/users/:id/permissions',
  auth,
  adminOnly,
  wrap(permissionController.deletePermissions)
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

// VIVA – Ahamed – login history incl. failed attempts (Admin)
router.get(
  '/sessions/login-history',
  auth,
  adminOnly,
  wrap(domainController.loginHistory)
);

// VIVA – Ahamed – "Check activity" for one session
router.get(
  '/sessions/:id/activity',
  auth,
  wrap(domainController.sessionActivity)
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
        activePlanFor
      } = await import(
        '../services/finance.service.js'
      );

      /*
       * VIVA – Herathge – ?vehicleId= returns that vehicle's own active
       * plan when it has one, otherwise the general active plan.
       */
      const configuration =
        await activePlanFor(
          req.query.vehicleId
        );

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

        data: {
          ...configuration.toJSON(),
          vehicleSpecific:
            configuration.vehicleId !== null
        },
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
    domainController.listFinance
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


/*
|--------------------------------------------------------------------------
| Complaints — Customer
|--------------------------------------------------------------------------
*/

router.post(
  '/complaints',
  complaintLimit,
  auth,
  customerOnly,
  validate(complaintCreateSchema),
  wrap(complaintController.createComplaint)
);

router.get(
  '/my/complaints',
  auth,
  customerOnly,
  wrap(complaintController.listMyComplaints)
);

router.get(
  '/my/complaints/:id',
  auth,
  customerOnly,
  wrap(complaintController.getMyComplaint)
);

router.post(
  '/my/complaints/:id/messages',
  auth,
  customerOnly,
  validate(complaintMessageSchema),
  wrap(complaintController.addMyMessage)
);

router.patch(
  '/my/complaints/:id/reopen',
  auth,
  customerOnly,
  validate(complaintReopenSchema),
  wrap(complaintController.reopenMyComplaint)
);

router.patch(
  '/my/complaints/:id/close',
  auth,
  customerOnly,
  wrap(complaintController.closeMyComplaint)
);

/*
|--------------------------------------------------------------------------
| Complaints — Admin and permitted Staff
|--------------------------------------------------------------------------
*/

router.get(
  '/complaints',
  auth,
  staffOrAdmin,
  requirePermission('canManageComplaints'),
  wrap(complaintController.listComplaints)
);

router.get(
  '/complaints/:id',
  auth,
  staffOrAdmin,
  requirePermission('canManageComplaints'),
  wrap(complaintController.getComplaint)
);

router.patch(
  '/complaints/:id',
  auth,
  staffOrAdmin,
  requirePermission('canManageComplaints'),
  validate(complaintUpdateSchema),
  wrap(complaintController.updateComplaint)
);

router.patch(
  '/complaints/:id/assign',
  auth,
  adminOnly,
  validate(complaintAssignSchema),
  wrap(complaintController.assignComplaint)
);

router.post(
  '/complaints/:id/messages',
  auth,
  staffOrAdmin,
  requirePermission('canManageComplaints'),
  validate(complaintMessageSchema),
  wrap(complaintController.addComplaintMessage)
);

router.delete(
  '/complaints/:id',
  auth,
  adminOnly,
  wrap(complaintController.deleteComplaint)
);

/*
|--------------------------------------------------------------------------
| Private Documents
|--------------------------------------------------------------------------
*/

router.post(
  '/documents',
  auth,
  markDocumentUpload,
  documentUpload.single('file'),
  wrap(documentController.uploadDocument)
);

router.get(
  '/documents',
  auth,
  wrap(documentController.listDocuments)
);

router.get(
  '/documents/:id',
  auth,
  wrap(documentController.getDocument)
);

router.get(
  '/documents/:id/download',
  auth,
  wrap(documentController.downloadDocument)
);

router.patch(
  '/documents/:id',
  auth,
  validate(documentUpdateSchema),
  wrap(documentController.updateDocument)
);

router.delete(
  '/documents/:id',
  auth,
  wrap(documentController.deleteDocument)
);

/*
|--------------------------------------------------------------------------
| Reports
|--------------------------------------------------------------------------
*/

router.get(
  '/reports/types',
  auth,
  staffOrAdmin,
  wrap(reportController.listTypes)
);

router.get(
  '/reports/:type/export/:format',
  auth,
  staffOrAdmin,
  wrap(reportController.exportReport)
);

router.get(
  '/reports/:type',
  auth,
  staffOrAdmin,
  wrap(reportController.runReport)
);

router.get(
  '/saved-reports',
  auth,
  staffOrAdmin,
  wrap(reportController.listSavedReports)
);

router.post(
  '/saved-reports',
  auth,
  staffOrAdmin,
  validate(savedReportSchema),
  wrap(reportController.createSavedReport)
);

router.get(
  '/saved-reports/:id/run',
  auth,
  staffOrAdmin,
  wrap(reportController.runSavedReport)
);

router.put(
  '/saved-reports/:id',
  auth,
  staffOrAdmin,
  validate(savedReportSchema),
  wrap(reportController.updateSavedReport)
);

router.delete(
  '/saved-reports/:id',
  auth,
  staffOrAdmin,
  wrap(reportController.deleteSavedReport)
);

/*
|--------------------------------------------------------------------------
| Dashboard overview and customer notifications
|--------------------------------------------------------------------------
*/

router.get(
  '/dashboard/summary',
  auth,
  staffOrAdmin,
  wrap(dashboardController.summary)
);

router.get(
  '/my/notifications',
  auth,
  customerOnly,
  wrap(dashboardController.myNotifications)
);

/*
|--------------------------------------------------------------------------
| Email delivery (Admin) and inbound replies
|--------------------------------------------------------------------------
*/

router.get(
  '/emails',
  auth,
  adminOnly,
  wrap(emailController.listEmails)
);

router.get(
  '/emails/config',
  auth,
  adminOnly,
  wrap(emailController.configuration)
);

router.post(
  '/emails/verify',
  auth,
  adminOnly,
  wrap(emailController.verify)
);

router.post(
  '/emails/test',
  auth,
  adminOnly,
  wrap(emailController.sendTest)
);

router.post(
  '/emails/process',
  auth,
  adminOnly,
  wrap(emailController.processQueueNow)
);

router.post(
  '/emails/:id/retry',
  auth,
  adminOnly,
  wrap(emailController.retry)
);

router.get(
  '/inbound-emails',
  auth,
  adminOnly,
  wrap(emailController.listInbound)
);

router.post(
  '/inbound/email',
  inboundLimit,
  multer({ limits: { fieldSize: 1024 * 1024, files: 0 } }).none(),
  wrap(emailController.receiveInbound)
);

/*
|--------------------------------------------------------------------------
| VIVA – Naaziq – Reply Templates (CRUD resource 4)
|--------------------------------------------------------------------------
| Admin, or Staff with "Manage enquiries" / "Manage complaints".
| The controller checks the permission and ownership.
*/

router.get('/reply-templates', auth, staffOrAdmin, wrap(replyTemplateController.listTemplates));
router.get('/reply-templates/:id', auth, staffOrAdmin, wrap(replyTemplateController.getTemplate));
router.post('/reply-templates', auth, staffOrAdmin, validate(replyTemplateSchema), wrap(replyTemplateController.createTemplate));
router.put('/reply-templates/:id', auth, staffOrAdmin, validate(replyTemplateSchema), wrap(replyTemplateController.updateTemplate));
router.delete('/reply-templates/:id', auth, staffOrAdmin, wrap(replyTemplateController.deleteTemplate));

/*
|--------------------------------------------------------------------------
| VIVA – Herathge – Finance Applications (CRUD resource 3)
|--------------------------------------------------------------------------
*/

const financeApplicationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many finance applications submitted. Please try again later.',
    errors: []
  }
});

// Customer: CREATE / READ / UPDATE / DELETE their own applications
router.post('/finance-applications', auth, customerOnly, financeApplicationLimit, validate(financeApplicationCreateSchema), wrap(financeApplicationController.createApplication));
router.get('/my/finance-applications', auth, customerOnly, wrap(financeApplicationController.listMyApplications));
router.get('/my/finance-applications/:id', auth, customerOnly, wrap(financeApplicationController.getMyApplication));
router.put('/my/finance-applications/:id', auth, customerOnly, validate(financeApplicationCustomerUpdateSchema), wrap(financeApplicationController.updateMyApplication));
router.patch('/my/finance-applications/:id/withdraw', auth, customerOnly, wrap(financeApplicationController.withdrawMyApplication));
router.delete('/my/finance-applications/:id', auth, customerOnly, wrap(financeApplicationController.deleteMyApplication));

// Admin: READ / UPDATE (review) / DELETE every application
router.get('/finance-applications', auth, adminOnly, wrap(financeApplicationController.listApplications));
router.get('/finance-applications/:id', auth, adminOnly, wrap(financeApplicationController.getApplication));
router.patch('/finance-applications/:id', auth, adminOnly, validate(financeApplicationReviewSchema), wrap(financeApplicationController.reviewApplication));
router.delete('/finance-applications/:id', auth, adminOnly, wrap(financeApplicationController.deleteApplication));

export default router;