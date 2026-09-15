import { z } from 'zod';

/*
|--------------------------------------------------------------------------
| Shared Validators
|--------------------------------------------------------------------------
*/

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(150);

const id = z.coerce
  .number()
  .int()
  .positive();

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

export const loginSchema = z.object({
  body: z.object({
    email,

    password: z
      .string()
      .min(8, 'Password must contain at least 8 characters')
      .max(72, 'Password cannot exceed 72 characters')
  }),

  query: z.any(),
  params: z.any()
});

export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must contain at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters'),

    email,

    phone: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9 ()-]{7,20}$/,
        'Enter a valid phone number'
      ),

    address: z
      .string()
      .trim()
      .max(500, 'Address cannot exceed 500 characters')
      .optional()
      .or(z.literal('')),

    password: z
      .string()
      .min(
        10,
        'Password must contain at least 10 characters'
      )
      .max(
        72,
        'Password cannot exceed 72 characters'
      )
      .regex(
        /[A-Z]/,
        'Password must contain at least one uppercase letter'
      )
      .regex(
        /[a-z]/,
        'Password must contain at least one lowercase letter'
      )
      .regex(
        /[0-9]/,
        'Password must contain at least one number'
      )
  }),

  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| Vehicles
|--------------------------------------------------------------------------
*/

export const vehicleSchema = z.object({
  body: z.object({
    make: z
      .string()
      .trim()
      .min(1, 'Vehicle make is required')
      .max(50),

    model: z
      .string()
      .trim()
      .min(1, 'Vehicle model is required')
      .max(50),

    year: z.coerce
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1),

    price: z.coerce
      .number()
      .positive('Price must be greater than zero'),

    mileage: z.coerce
      .number()
      .int()
      .nonnegative('Mileage cannot be negative')
      .default(0),

    condition: z.enum([
      'New',
      'Used',
      'Reconditioned'
    ]),

    type: z
      .string()
      .trim()
      .min(1, 'Vehicle type is required')
      .max(50),

    fuelType: z
      .string()
      .trim()
      .min(1, 'Fuel type is required')
      .max(30),

    transmission: z
      .string()
      .trim()
      .min(1, 'Transmission is required')
      .max(30),

    engineCapacity: z
      .string()
      .trim()
      .max(30)
      .optional(),

    color: z
      .string()
      .trim()
      .max(40)
      .optional(),

    description: z
      .string()
      .trim()
      .max(5000)
      .optional(),

    status: z
      .enum([
        'Draft',
        'Available',
        'Sold',
        'Archived'
      ])
      .default('Draft')
  }),

  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| Enquiries
|--------------------------------------------------------------------------
*/

export const enquirySchema = z.object({
  body: z.object({
    vehicleId: id.optional(),

    message: z
      .string()
      .trim()
      .min(
        10,
        'Message must contain at least 10 characters'
      )
      .max(
        3000,
        'Message cannot exceed 3000 characters'
      )
  }),

  query: z.any(),
  params: z.any()
});

export const enquiryUpdateSchema = z.object({
  body: z.object({
    status: z.enum([
      'New',
      'In Progress',
      'Responded',
      'Archived'
    ])
  }),

  query: z.any(),

  params: z.object({
    id
  })
});

export const enquiryAssignmentSchema = z.object({
  body: z.object({
    staffId: id
  }),

  query: z.any(),

  params: z.object({
    id
  })
});

/*
|--------------------------------------------------------------------------
| User Management
|--------------------------------------------------------------------------
*/

export const userSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must contain at least 2 characters')
      .max(100),

    email,

    password: z
      .string()
      .min(
        10,
        'Password must contain at least 10 characters'
      )
      .max(72)
      .regex(
        /[A-Z]/,
        'Password must contain an uppercase letter'
      )
      .regex(
        /[a-z]/,
        'Password must contain a lowercase letter'
      )
      .regex(
        /[0-9]/,
        'Password must contain a number'
      )
      .optional(),

    role: z.enum([
      'Admin',
      'Staff',
      'Customer'
    ]),

    isActive: z
      .boolean()
      .optional(),

    phone: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9 ()-]{7,20}$/,
        'Enter a valid phone number'
      )
      .optional()
      .or(z.literal('')),

    address: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal(''))
  }),

  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| Enquiry Responses
|--------------------------------------------------------------------------
*/

export const responseSchema = z.object({
  body: z.object({
    subject: z
      .string()
      .trim()
      .min(2, 'Subject is required')
      .max(180),

    responseBody: z
      .string()
      .trim()
      .min(2, 'Response body is required')
      .max(10000),

    status: z
      .enum([
        'Draft',
        'Sent'
      ])
      .default('Draft')
  }),

  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| Company Content
|--------------------------------------------------------------------------
*/

export const contentSchema = z.object({
  body: z.object({
    sectionSlug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9-]+$/,
        'Slug can contain lowercase letters, numbers and hyphens only'
      ),

    title: z
      .string()
      .trim()
      .min(2, 'Title is required')
      .max(180),

    body: z
      .string()
      .trim()
      .min(2, 'Content body is required'),

    imageUrl: z
      .string()
      .trim()
      .url('Enter a valid image URL')
      .optional()
      .or(z.literal('')),

    displayOrder: z.coerce
      .number()
      .int()
      .default(0),

    isPublished: z
      .boolean()
      .default(false)
  }),

  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| Financing Configuration
|--------------------------------------------------------------------------
*/

export const financeSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Configuration name is required')
      .max(100),

    annualInterestRate: z.coerce
      .number()
      .min(0)
      .max(100),

    minDownPaymentPct: z.coerce
      .number()
      .min(0)
      .max(100),

    maxLoanTermMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(360),

    isActive: z
      .boolean()
      .default(false)
  }),

  query: z.any(),
  params: z.any()
});
/*
|--------------------------------------------------------------------------
| Staff Permissions
|--------------------------------------------------------------------------
*/

export const staffPermissionSchema = z.object({
  body: z.object({
    canManageInventory: z.boolean(),

    canManageEnquiries: z.boolean(),

    canViewAssignedContacts: z.boolean(),

    canArchiveRecords: z.boolean(),

    canViewLimitedAnalytics: z.boolean()
  }),

  query: z.any(),
  params: z.any()
});
/*
|--------------------------------------------------------------------------
| Account Profile
|--------------------------------------------------------------------------
*/

export const profileUpdateSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must contain at least 2 characters')
      .max(100),

    phone: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9 ()-]{7,20}$/,
        'Enter a valid phone number'
      ),

    address: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal(''))
  }),

  query: z.any(),
  params: z.any()
});

export const passwordChangeSchema = z.object({
  body: z.object({
    currentPassword: z
      .string()
      .min(8, 'Enter your current password')
      .max(72),

    newPassword: z
      .string()
      .min(
        10,
        'New password must contain at least 10 characters'
      )
      .max(72)
      .regex(
        /[A-Z]/,
        'New password must contain an uppercase letter'
      )
      .regex(
        /[a-z]/,
        'New password must contain a lowercase letter'
      )
      .regex(
        /[0-9]/,
        'New password must contain a number'
      )
  }),

  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| Test-Drive Booking Validation
|--------------------------------------------------------------------------
*/

const bookingDateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Preferred date must use YYYY-MM-DD format'
  )
  .refine(
    (value) => {
      const selectedDate =
        new Date(`${value}T00:00:00`);

      const today = new Date();

      today.setHours(0, 0, 0, 0);

      return (
        !Number.isNaN(
          selectedDate.getTime()
        ) &&
        selectedDate >= today
      );
    },
    {
      message:
        'Preferred date cannot be in the past'
    }
  );

const bookingTimeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    'Preferred time must use HH:MM format'
  );

export const bookingCreateSchema =
  z.object({
    body: z.object({
      vehicleId: z.coerce
        .number()
        .int()
        .positive(),

      preferredDate:
        bookingDateSchema,

      preferredTime:
        bookingTimeSchema,

      customerNote: z
        .string()
        .trim()
        .max(
          2000,
          'Note cannot exceed 2000 characters'
        )
        .optional()
        .or(z.literal(''))
    }),

    query: z.any(),
    params: z.any()
  });

export const bookingUpdateSchema =
  z.object({
    body: z.object({
      status: z.enum([
        'Pending',
        'Confirmed',
        'Completed',
        'Cancelled'
      ]),

      staffNote: z
        .string()
        .trim()
        .max(
          2000,
          'Staff note cannot exceed 2000 characters'
        )
        .optional()
        .or(z.literal(''))
    }),

    query: z.any(),
    params: z.any()
  });

export const bookingAssignmentSchema =
  z.object({
    body: z.object({
      assignedTo: z.coerce
        .number()
        .int()
        .positive()
        .nullable()
    }),

    query: z.any(),
    params: z.any()
  });
  export const vehicleImageUpdateSchema =
  z.object({
    body: z.object({
      altText: z
        .string()
        .trim()
        .max(180)
        .optional(),

      sortOrder: z.coerce
        .number()
        .int()
        .min(0)
        .optional(),

      isPrimary: z
        .boolean()
        .optional()
    }),

    query: z.any(),
    params: z.any()
  });