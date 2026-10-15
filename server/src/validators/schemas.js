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
      .default(false),

    /*
     * VIVA – Herathge – the ONE vehicle this plan is for.
     * null (or missing) = the general plan for every other vehicle.
     */
    vehicleId: z
      .preprocess(
        (value) => (value === '' || value === 'general' ? null : value),
        z.coerce.number().int().positive('Choose a vehicle').nullable()
      )
      .optional()
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

    canManageComplaints: z.boolean().default(false),
    canViewLimitedAnalytics: z.boolean(),

    // October 2026 – optional so older clients keep working (missing =
    // unchanged).
    canManageBookings: z.boolean().optional(),
    canExportReports: z.boolean().optional(),

    // "Undo" in the dashboard re-sends the previous values with undo: true.
    undo: z.boolean().optional()
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
/*
|--------------------------------------------------------------------------
| Complaints
|--------------------------------------------------------------------------
*/

const complaintCategories = [
  'Vehicle Condition',
  'Test Drive',
  'Enquiry Handling',
  'Staff Conduct',
  'Website',
  'Financing',
  'Other'
];

const complaintStatuses = [
  'Submitted',
  'Under Review',
  'In Progress',
  'Resolved',
  'Closed'
];

const complaintPriorities = ['Low', 'Medium', 'High', 'Urgent'];

const optionalId = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  id.optional()
);

export const complaintCreateSchema = z.object({
  body: z.object({
    category: z.enum(complaintCategories, {
      message: 'Choose a complaint category'
    }),
    subject: z
      .string()
      .trim()
      .min(5, 'Subject must contain at least 5 characters')
      .max(180, 'Subject cannot exceed 180 characters'),
    description: z
      .string()
      .trim()
      .min(20, 'Please describe the problem in at least 20 characters')
      .max(5000, 'Description cannot exceed 5000 characters'),
    priority: z.enum(complaintPriorities).optional(),
    vehicleId: optionalId,
    bookingId: optionalId,
    enquiryId: optionalId
  }),
  query: z.any(),
  params: z.any()
});

export const complaintMessageSchema = z.object({
  body: z.object({
    body: z
      .string()
      .trim()
      .min(2, 'Message is required')
      .max(5000, 'Message cannot exceed 5000 characters'),
    isInternal: z.boolean().optional().default(false)
  }),
  query: z.any(),
  params: z.object({ id })
});

export const complaintReopenSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .trim()
      .min(5, 'Tell us why you are reopening the complaint')
      .max(1000)
  }),
  query: z.any(),
  params: z.object({ id })
});

export const complaintUpdateSchema = z.object({
  body: z.object({
    status: z.enum(complaintStatuses).optional(),
    priority: z.enum(complaintPriorities).optional(),
    category: z.enum(complaintCategories).optional(),
    resolutionSummary: z.string().trim().max(5000).optional().or(z.literal('')),
    note: z.string().trim().max(500).optional().or(z.literal('')),
    notifyCustomer: z.boolean().optional()
  }),
  query: z.any(),
  params: z.object({ id })
});

export const complaintAssignSchema = z.object({
  body: z.object({
    staffId: z.coerce.number().int().positive().nullable()
  }),
  query: z.any(),
  params: z.object({ id })
});

/*
|--------------------------------------------------------------------------
| Documents
|--------------------------------------------------------------------------
*/

export const documentUpdateSchema = z.object({
  body: z.object({
    originalName: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    category: z
      .enum(['Complaint Evidence', 'Booking Document', 'Vehicle Document', 'Identity Document', 'Other', 'Finance Document'])
      .optional(),
    visibility: z.enum(['Owner', 'Staff']).optional()
  }),
  query: z.any(),
  params: z.object({ id })
});

/*
|--------------------------------------------------------------------------
| Saved reports
|--------------------------------------------------------------------------
*/

export const savedReportSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Give the report a name')
      .max(120),
    reportType: z.string().trim().min(2).max(40),
    filters: z.record(z.string(), z.any()).optional().default({})
  }),
  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| Customer booking reschedule
|--------------------------------------------------------------------------
*/

export const bookingRescheduleSchema = z.object({
  body: z.object({
    preferredDate: bookingDateSchema,
    preferredTime: bookingTimeSchema,
    customerNote: z
      .string()
      .trim()
      .max(2000, 'Note cannot exceed 2000 characters')
      .optional()
      .or(z.literal(''))
  }),
  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| VIVA – 16-CRUD completion (October 2026)
|--------------------------------------------------------------------------
*/

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

/* Amri – Wishlists: UPDATE (private note) */
export const wishlistNoteSchema = z.object({
  body: z.object({
    note: z.string().trim().max(255, 'Notes can be up to 255 characters').optional().nullable().default(null)
  }),
  query: z.any(),
  params: z.any()
});

/* Ahamed – Staff Permissions: CREATE (all flags optional, default false) */
export const staffPermissionCreateSchema = z.object({
  body: z
    .object({
      canManageInventory: z.boolean().optional(),
      canManageEnquiries: z.boolean().optional(),
      canViewAssignedContacts: z.boolean().optional(),
      canArchiveRecords: z.boolean().optional(),
      canManageComplaints: z.boolean().optional(),
      canViewLimitedAnalytics: z.boolean().optional(),
      canManageBookings: z.boolean().optional(),
      canExportReports: z.boolean().optional(),
      undo: z.boolean().optional()
    })
    .optional()
    .default({}),
  query: z.any(),
  params: z.any()
});

/* Naaziq – Reply Templates: CREATE / UPDATE */
export const replyTemplateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Give the template a title of at least 3 characters').max(120),
    category: z.enum(['Enquiry', 'Complaint', 'General']).default('General'),
    subject: optionalText(180),
    body: z
      .string()
      .trim()
      .min(10, 'The template text must contain at least 10 characters')
      .max(5000, 'The template text can be up to 5000 characters'),
    isActive: z.boolean().optional().default(true)
  }),
  query: z.any(),
  params: z.any()
});

/* Herathge – Finance Applications */
const money = (label) =>
  z.coerce
    .number({ message: `${label} must be a number` })
    .finite()
    .min(0, `${label} cannot be negative`)
    .max(999999999999, `${label} is too large`);

const financePhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number');

const financeFields = {
  downPayment: money('Down payment'),
  termMonths: z.coerce.number().int('Term must be whole months').min(1, 'Term must be at least 1 month').max(360),
  employmentType: z.enum(['Salaried', 'Self-employed', 'Business owner', 'Other'], {
    message: 'Choose an employment type'
  }),
  monthlyIncome: money('Monthly income').refine((value) => value > 0, 'Monthly income must be more than 0'),
  contactPhone: financePhone,
  customerNotes: optionalText(2000)
};

// CREATE (customer)
export const financeApplicationCreateSchema = z.object({
  body: z.object({
    vehicleId: z.coerce.number().int().positive('Choose a vehicle'),
    ...financeFields
  }),
  query: z.any(),
  params: z.any()
});

// UPDATE (customer, only while the application is still "Submitted")
export const financeApplicationCustomerUpdateSchema = z.object({
  body: z.object(financeFields),
  query: z.any(),
  params: z.any()
});

// UPDATE (staff review)
export const financeApplicationReviewSchema = z.object({
  body: z.object({
    status: z.enum(['Submitted', 'Under Review', 'Approved in Principle', 'Declined', 'Withdrawn']),
    decisionNote: optionalText(2000),
    staffNotes: optionalText(4000)
  }),
  query: z.any(),
  params: z.any()
});

/*
|--------------------------------------------------------------------------
| VIVA – Ahamed – Forgot password / reset password / bulk user actions
|--------------------------------------------------------------------------
*/
const strongPassword = (label = 'Password') =>
  z
    .string()
    .min(10, `${label} must contain at least 10 characters`)
    .max(72, `${label} cannot exceed 72 characters`)
    .regex(/[A-Z]/, `${label} must contain an uppercase letter`)
    .regex(/[a-z]/, `${label} must contain a lowercase letter`)
    .regex(/[0-9]/, `${label} must contain a number`);

export const forgotPasswordSchema = z.object({
  body: z.object({
    email
  }),
  query: z.any(),
  params: z.any()
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'This reset link is invalid or has expired. Please request a new one.'),
    newPassword: strongPassword('New password')
  }),
  query: z.any(),
  params: z.any()
});

export const bulkUsersSchema = z.object({
  body: z.object({
    action: z.enum(['activate', 'deactivate'], { message: 'Choose activate or deactivate' }),
    userIds: z.array(z.coerce.number().int().positive()).min(1, 'Select at least one account').max(200)
  }),
  query: z.any(),
  params: z.any()
});

/*
| VIVA – Ahamed – "Delete staff" for several Staff members at once
*/
export const bulkDeleteStaffSchema = z.object({
  body: z.object({
    userIds: z.array(z.coerce.number().int().positive()).min(1, 'Select at least one Staff member').max(200)
  }),
  query: z.any(),
  params: z.any()
});

/*
| VIVA – Amri – a Staff member's leave days (staff availability)
*/
const leaveDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-20').refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Enter a real date');

export const staffLeaveSchema = z.object({
  body: z
    .object({
      staffId: id,
      startDate: leaveDate,
      endDate: leaveDate,
      reason: z.string().trim().max(150, 'Reason cannot exceed 150 characters').optional().nullable()
    })
    .refine((body) => body.endDate >= body.startDate, { message: 'The last day cannot be before the first day', path: ['endDate'] }),
  query: z.any(),
  params: z.any()
});
