import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

import WishlistModel
  from './Wishlist.js';

import TestDriveBookingModel
  from './TestDriveBooking.js';

export { sequelize };

const opts = {
  underscored: true,
  timestamps: true
};

export const Wishlist = WishlistModel;

export const TestDriveBooking =
  TestDriveBookingModel;

/*
|--------------------------------------------------------------------------
| Users
|--------------------------------------------------------------------------
*/

export const User = sequelize.define(
  'User',
  {
    userId: {
      field: 'user_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true
    },

    passwordHash: {
      field: 'password_hash',
      type: DataTypes.STRING(255),
      allowNull: false
    },

    role: {
      type: DataTypes.ENUM(
        'Admin',
        'Staff',
        'Customer'
      ),
      allowNull: false,
      defaultValue: 'Customer'
    },

    isActive: {
      field: 'is_active',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },

    address: {
      type: DataTypes.STRING(500),
      allowNull: true
    },

    profileImageUrl: {
      field: 'profile_image_url',
      type: DataTypes.STRING(500),
      allowNull: true
    },

    emailVerifiedAt: {
      field: 'email_verified_at',
      type: DataTypes.DATE,
      allowNull: true
    },

    lastLoginAt: {
      field: 'last_login_at',
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'users',

    defaultScope: {
      attributes: {
        exclude: ['passwordHash']
      }
    }
  }
);

/*
|--------------------------------------------------------------------------
| Sessions
|--------------------------------------------------------------------------
*/

export const Session = sequelize.define(
  'AdminSession',
  {
    sessionId: {
      field: 'session_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    userId: {
      field: 'user_id',
      type: DataTypes.INTEGER,
      allowNull: false
    },

    refreshTokenHash: {
      field: 'refresh_token_hash',
      type: DataTypes.STRING(255),
      allowNull: false
    },

    expiresAt: {
      field: 'expires_at',
      type: DataTypes.DATE,
      allowNull: false
    },

    revokedAt: {
      field: 'revoked_at',
      type: DataTypes.DATE,
      allowNull: true
    },

    ipAddress: {
      field: 'ip_address',
      type: DataTypes.STRING(45),
      allowNull: true
    },

    userAgent: {
      field: 'user_agent',
      type: DataTypes.STRING(500),
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'admin_sessions',
    updatedAt: false
  }
);

/*
|--------------------------------------------------------------------------
| Staff Permissions
|--------------------------------------------------------------------------
*/

export const StaffPermission = sequelize.define(
  'StaffPermission',
  {
    permissionId: {
      field: 'permission_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    userId: {
      field: 'user_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },

    canManageInventory: {
      field: 'can_manage_inventory',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    canManageEnquiries: {
      field: 'can_manage_enquiries',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    canViewAssignedContacts: {
      field: 'can_view_assigned_contacts',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    canArchiveRecords: {
      field: 'can_archive_records',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    canViewLimitedAnalytics: {
      field: 'can_view_limited_analytics',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    ...opts,
    tableName: 'staff_permissions'
  }
);

/*
|--------------------------------------------------------------------------
| Vehicles
|--------------------------------------------------------------------------
*/

export const Vehicle = sequelize.define(
  'Vehicle',
  {
    vehicleId: {
      field: 'vehicle_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    make: {
      type: DataTypes.STRING(50),
      allowNull: false
    },

    model: {
      type: DataTypes.STRING(50),
      allowNull: false
    },

    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    price: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false
    },

    mileage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    condition: {
      type: DataTypes.ENUM(
        'New',
        'Used',
        'Reconditioned'
      ),
      allowNull: false
    },

    type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },

    fuelType: {
      field: 'fuel_type',
      type: DataTypes.STRING(30),
      allowNull: false
    },

    transmission: {
      type: DataTypes.STRING(30),
      allowNull: false
    },

    engineCapacity: {
      field: 'engine_capacity',
      type: DataTypes.STRING(30),
      allowNull: true
    },

    color: {
      type: DataTypes.STRING(40),
      allowNull: true
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    status: {
      type: DataTypes.ENUM(
        'Draft',
        'Available',
        'Sold',
        'Archived'
      ),
      allowNull: false,
      defaultValue: 'Draft'
    },

    createdBy: {
      field: 'created_by',
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'vehicles',
    paranoid: true,
    deletedAt: 'deleted_at'
  }
);

/*
|--------------------------------------------------------------------------
| Vehicle Images
|--------------------------------------------------------------------------
*/

export const VehicleImage = sequelize.define(
  'VehicleImage',
  {
    imageId: {
      field: 'image_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    vehicleId: {
      field: 'vehicle_id',
      type: DataTypes.INTEGER,
      allowNull: false
    },

    url: {
      type: DataTypes.STRING(500),
      allowNull: false
    },

    publicId: {
      field: 'public_id',
      type: DataTypes.STRING(255),
      allowNull: true
    },

    altText: {
      field: 'alt_text',
      type: DataTypes.STRING(180),
      allowNull: true
    },

    isPrimary: {
      field: 'is_primary',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    sortOrder: {
      field: 'sort_order',
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    ...opts,
    tableName: 'vehicle_images',
    updatedAt: false
  }
);

/*
|--------------------------------------------------------------------------
| Enquiries
|--------------------------------------------------------------------------
*/

export const Enquiry = sequelize.define(
  'Enquiry',
  {
    enquiryId: {
      field: 'enquiry_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    vehicleId: {
      field: 'vehicle_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },

    customerId: {
      field: 'customer_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },

    assignedTo: {
      field: 'assigned_to',
      type: DataTypes.INTEGER,
      allowNull: true
    },

    assignedAt: {
      field: 'assigned_at',
      type: DataTypes.DATE,
      allowNull: true
    },

    assignedBy: {
      field: 'assigned_by',
      type: DataTypes.INTEGER,
      allowNull: true
    },

    vehicleReference: {
      field: 'vehicle_reference',
      type: DataTypes.STRING(180),
      allowNull: false
    },

    customerName: {
      field: 'customer_name',
      type: DataTypes.STRING(100),
      allowNull: false
    },

    customerEmail: {
      field: 'customer_email',
      type: DataTypes.STRING(150),
      allowNull: false
    },

    customerPhone: {
      field: 'customer_phone',
      type: DataTypes.STRING(30),
      allowNull: false
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    status: {
      type: DataTypes.ENUM(
        'New',
        'In Progress',
        'Responded',
        'Archived'
      ),
      allowNull: false,
      defaultValue: 'New'
    },

    respondedAt: {
      field: 'responded_at',
      type: DataTypes.DATE,
      allowNull: true
    },

    respondedBy: {
      field: 'responded_by',
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'enquiries'
  }
);

/*
|--------------------------------------------------------------------------
| Enquiry Responses
|--------------------------------------------------------------------------
*/

export const Response = sequelize.define(
  'EnquiryResponse',
  {
    responseId: {
      field: 'response_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    enquiryId: {
      field: 'enquiry_id',
      type: DataTypes.INTEGER,
      allowNull: false
    },

    adminId: {
      field: 'admin_id',
      type: DataTypes.INTEGER,
      allowNull: false
    },

    subject: {
      type: DataTypes.STRING(180),
      allowNull: false
    },

    responseBody: {
      field: 'response_body',
      type: DataTypes.TEXT,
      allowNull: false
    },

    status: {
      type: DataTypes.ENUM(
        'Draft',
        'Sent'
      ),
      allowNull: false,
      defaultValue: 'Draft'
    },

    sentAt: {
      field: 'sent_at',
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'enquiry_responses'
  }
);

/*
|--------------------------------------------------------------------------
| Company Content
|--------------------------------------------------------------------------
*/

export const Content = sequelize.define(
  'CompanyContent',
  {
    contentId: {
      field: 'content_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    sectionSlug: {
      field: 'section_slug',
      type: DataTypes.STRING(80),
      allowNull: false
    },

    title: {
      type: DataTypes.STRING(180),
      allowNull: false
    },

    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    imageUrl: {
      field: 'image_url',
      type: DataTypes.STRING(500),
      allowNull: true
    },

    displayOrder: {
      field: 'display_order',
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    isPublished: {
      field: 'is_published',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    ...opts,
    tableName: 'company_content'
  }
);

/*
|--------------------------------------------------------------------------
| Financing Configurations
|--------------------------------------------------------------------------
*/

export const Finance = sequelize.define(
  'FinancingConfig',
  {
    configId: {
      field: 'config_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },

    annualInterestRate: {
      field: 'annual_interest_rate',
      type: DataTypes.DECIMAL(6, 3),
      allowNull: false
    },

    minDownPaymentPct: {
      field: 'min_down_payment_pct',
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },

    maxLoanTermMonths: {
      field: 'max_loan_term_months',
      type: DataTypes.INTEGER,
      allowNull: false
    },

    isActive: {
      field: 'is_active',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    ...opts,
    tableName: 'financing_configs'
  }
);

/*
|--------------------------------------------------------------------------
| Relationships
|--------------------------------------------------------------------------
*/

// User sessions
User.hasMany(Session, {
  foreignKey: 'userId',
  as: 'sessions'
});

Session.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Staff permissions
User.hasOne(StaffPermission, {
  foreignKey: 'userId',
  as: 'permissions'
});

StaffPermission.belongsTo(User, {
  foreignKey: 'userId',
  as: 'staff'
});

// Vehicle creator
User.hasMany(Vehicle, {
  foreignKey: 'createdBy',
  as: 'createdVehicles'
});

Vehicle.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// Vehicle images
Vehicle.hasMany(VehicleImage, {
  foreignKey: 'vehicleId',
  as: 'images'
});

VehicleImage.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle'
});

// Vehicle enquiries
Vehicle.hasMany(Enquiry, {
  foreignKey: 'vehicleId',
  as: 'enquiries'
});

Enquiry.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle'
});

// Customer enquiries
User.hasMany(Enquiry, {
  foreignKey: 'customerId',
  as: 'customerEnquiries'
});

Enquiry.belongsTo(User, {
  foreignKey: 'customerId',
  as: 'customer'
});

// Staff-assigned enquiries
User.hasMany(Enquiry, {
  foreignKey: 'assignedTo',
  as: 'assignedEnquiries'
});

Enquiry.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignedStaff'
});

// Admin who assigned the enquiry
User.hasMany(Enquiry, {
  foreignKey: 'assignedBy',
  as: 'enquiryAssignments'
});

Enquiry.belongsTo(User, {
  foreignKey: 'assignedBy',
  as: 'assignedByUser'
});

// User who responded
User.hasMany(Enquiry, {
  foreignKey: 'respondedBy',
  as: 'respondedEnquiries'
});

Enquiry.belongsTo(User, {
  foreignKey: 'respondedBy',
  as: 'respondedByUser'
});

// Enquiry responses
Enquiry.hasMany(Response, {
  foreignKey: 'enquiryId',
  as: 'responses'
});

Response.belongsTo(Enquiry, {
  foreignKey: 'enquiryId',
  as: 'enquiry'
});

// Staff/Admin response author
User.hasMany(Response, {
  foreignKey: 'adminId',
  as: 'enquiryResponses'
});

Response.belongsTo(User, {
  foreignKey: 'adminId',
  as: 'author'
});

/*
|--------------------------------------------------------------------------
| Customer Wishlists
|--------------------------------------------------------------------------
*/

User.hasMany(Wishlist, {
  foreignKey: 'customerId',
  as: 'wishlistItems'
});

Wishlist.belongsTo(User, {
  foreignKey: 'customerId',
  as: 'customer'
});

Vehicle.hasMany(Wishlist, {
  foreignKey: 'vehicleId',
  as: 'wishlistEntries'
});

Wishlist.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle'
});

/*
|--------------------------------------------------------------------------
| Test-Drive Bookings
|--------------------------------------------------------------------------
*/

// Customer who created the booking
User.hasMany(TestDriveBooking, {
  foreignKey: 'customerId',
  as: 'testDriveBookings'
});

TestDriveBooking.belongsTo(User, {
  foreignKey: 'customerId',
  as: 'customer'
});

// Vehicle selected for the test drive
Vehicle.hasMany(TestDriveBooking, {
  foreignKey: 'vehicleId',
  as: 'testDriveBookings'
});

TestDriveBooking.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle'
});

// Staff member assigned to handle the booking
User.hasMany(TestDriveBooking, {
  foreignKey: 'assignedTo',
  as: 'assignedTestDriveBookings'
});

TestDriveBooking.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignedStaff'
});

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

export default {
  sequelize,
  User,
  Session,
  StaffPermission,
  Vehicle,
  VehicleImage,
  Enquiry,
  Response,
  Content,
  Finance,
  Wishlist,
  TestDriveBooking
};