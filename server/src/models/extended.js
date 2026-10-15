import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

/*
|--------------------------------------------------------------------------
| Extended Models
|--------------------------------------------------------------------------
|
| Complaints, private documents, email delivery logs, inbound email
| replies, the activity audit log and saved report definitions.
| Tables are created by migration 202610110001.
|
*/

const opts = {
  underscored: true,
  timestamps: true
};

export const COMPLAINT_CATEGORIES = [
  'Vehicle Condition',
  'Test Drive',
  'Enquiry Handling',
  'Staff Conduct',
  'Website',
  'Financing',
  'Other'
];

export const COMPLAINT_STATUSES = [
  'Submitted',
  'Under Review',
  'In Progress',
  'Resolved',
  'Closed'
];

export const COMPLAINT_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export const DOCUMENT_CATEGORIES = [
  'Complaint Evidence',
  'Booking Document',
  'Vehicle Document',
  'Identity Document',
  'Other',
  // Herathge – Finance Applications: payslips, bank statements, etc.
  'Finance Document'
];

export const EMAIL_STATUSES = ['Queued', 'Sending', 'Accepted', 'Failed', 'Preview'];

export const Complaint = sequelize.define(
  'Complaint',
  {
    complaintId: {
      field: 'complaint_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    reference: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true
    },
    customerId: {
      field: 'customer_id',
      type: DataTypes.INTEGER,
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM(...COMPLAINT_CATEGORIES),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(180),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM(...COMPLAINT_PRIORITIES),
      allowNull: false,
      defaultValue: 'Medium'
    },
    status: {
      type: DataTypes.ENUM(...COMPLAINT_STATUSES),
      allowNull: false,
      defaultValue: 'Submitted'
    },
    vehicleId: {
      field: 'vehicle_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    bookingId: {
      field: 'booking_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    enquiryId: {
      field: 'enquiry_id',
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
    resolutionSummary: {
      field: 'resolution_summary',
      type: DataTypes.TEXT,
      allowNull: true
    },
    resolvedAt: {
      field: 'resolved_at',
      type: DataTypes.DATE,
      allowNull: true
    },
    closedAt: {
      field: 'closed_at',
      type: DataTypes.DATE,
      allowNull: true
    },
    reopenedCount: {
      field: 'reopened_count',
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    lastActivityAt: {
      field: 'last_activity_at',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    ...opts,
    tableName: 'complaints'
  }
);

export const ComplaintMessage = sequelize.define(
  'ComplaintMessage',
  {
    messageId: {
      field: 'message_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    complaintId: {
      field: 'complaint_id',
      type: DataTypes.INTEGER,
      allowNull: false
    },
    authorId: {
      field: 'author_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    authorRole: {
      field: 'author_role',
      type: DataTypes.ENUM('Customer', 'Staff', 'Admin', 'System', 'Email'),
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isInternal: {
      field: 'is_internal',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    source: {
      type: DataTypes.ENUM('Web', 'Email'),
      allowNull: false,
      defaultValue: 'Web'
    }
  },
  {
    ...opts,
    tableName: 'complaint_messages'
  }
);

export const ComplaintStatusHistory = sequelize.define(
  'ComplaintStatusHistory',
  {
    historyId: {
      field: 'history_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    complaintId: {
      field: 'complaint_id',
      type: DataTypes.INTEGER,
      allowNull: false
    },
    fromStatus: {
      field: 'from_status',
      type: DataTypes.STRING(30),
      allowNull: true
    },
    toStatus: {
      field: 'to_status',
      type: DataTypes.STRING(30),
      allowNull: false
    },
    changedBy: {
      field: 'changed_by',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'complaint_status_history',
    updatedAt: false
  }
);

export const Document = sequelize.define(
  'Document',
  {
    documentId: {
      field: 'document_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    // NULL once the Staff member who uploaded it was permanently deleted
    uploadedBy: {
      field: 'uploaded_by',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM(...DOCUMENT_CATEGORIES),
      allowNull: false,
      defaultValue: 'Other'
    },
    complaintId: {
      field: 'complaint_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    bookingId: {
      field: 'booking_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    vehicleId: {
      field: 'vehicle_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    financeApplicationId: {
      field: 'finance_application_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    originalName: {
      field: 'original_name',
      type: DataTypes.STRING(255),
      allowNull: false
    },
    storageKey: {
      field: 'storage_key',
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    mimeType: {
      field: 'mime_type',
      type: DataTypes.STRING(100),
      allowNull: false
    },
    extension: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    sizeBytes: {
      field: 'size_bytes',
      type: DataTypes.INTEGER,
      allowNull: false
    },
    checksumSha256: {
      field: 'checksum_sha256',
      type: DataTypes.CHAR(64),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    visibility: {
      type: DataTypes.ENUM('Owner', 'Staff'),
      allowNull: false,
      defaultValue: 'Owner'
    }
  },
  {
    ...opts,
    tableName: 'documents',
    defaultScope: {
      attributes: {
        exclude: ['storageKey']
      }
    }
  }
);

export const EmailLog = sequelize.define(
  'EmailLog',
  {
    emailId: {
      field: 'email_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    messageKey: {
      field: 'message_key',
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true
    },
    recipient: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    replyTo: {
      field: 'reply_to',
      type: DataTypes.STRING(150),
      allowNull: true
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    template: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    relatedType: {
      field: 'related_type',
      type: DataTypes.STRING(30),
      allowNull: true
    },
    relatedId: {
      field: 'related_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(...EMAIL_STATUSES),
      allowNull: false,
      defaultValue: 'Queued'
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    maxAttempts: {
      field: 'max_attempts',
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    },
    nextAttemptAt: {
      field: 'next_attempt_at',
      type: DataTypes.DATE,
      allowNull: true
    },
    lastError: {
      field: 'last_error',
      type: DataTypes.STRING(500),
      allowNull: true
    },
    providerMessageId: {
      field: 'provider_message_id',
      type: DataTypes.STRING(255),
      allowNull: true
    },
    acceptedAt: {
      field: 'accepted_at',
      type: DataTypes.DATE,
      allowNull: true
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: {
      field: 'created_by',
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'email_logs',
    defaultScope: {
      attributes: {
        exclude: ['payload']
      }
    }
  }
);

export const InboundEmail = sequelize.define(
  'InboundEmail',
  {
    inboundId: {
      field: 'inbound_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    providerMessageId: {
      field: 'provider_message_id',
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    fromAddress: {
      field: 'from_address',
      type: DataTypes.STRING(150),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('Matched', 'Unmatched', 'Rejected'),
      allowNull: false
    },
    complaintId: {
      field: 'complaint_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    enquiryId: {
      field: 'enquiry_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    complaintMessageId: {
      field: 'complaint_message_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    receivedAt: {
      field: 'received_at',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    ...opts,
    tableName: 'inbound_emails'
  }
);

export const ActivityLog = sequelize.define(
  'ActivityLog',
  {
    activityId: {
      field: 'activity_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    actorId: {
      field: 'actor_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    actorRole: {
      field: 'actor_role',
      type: DataTypes.STRING(20),
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    entityType: {
      field: 'entity_type',
      type: DataTypes.STRING(40),
      allowNull: false
    },
    entityId: {
      field: 'entity_id',
      type: DataTypes.INTEGER,
      allowNull: true
    },
    summary: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    ipAddress: {
      field: 'ip_address',
      type: DataTypes.STRING(45),
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'activity_logs',
    updatedAt: false
  }
);

export const SavedReport = sequelize.define(
  'SavedReport',
  {
    reportId: {
      field: 'report_id',
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    reportType: {
      field: 'report_type',
      type: DataTypes.STRING(40),
      allowNull: false
    },
    filters: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const raw = this.getDataValue('filters');

        try {
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      },
      set(value) {
        this.setDataValue('filters', JSON.stringify(value || {}));
      }
    },
    createdBy: {
      field: 'created_by',
      type: DataTypes.INTEGER,
      allowNull: false
    },
    lastRunAt: {
      field: 'last_run_at',
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    ...opts,
    tableName: 'saved_reports'
  }
);

/*
|--------------------------------------------------------------------------
| VIVA – Naaziq – Customer Enquiry module – CRUD resource 4: Reply Templates
|--------------------------------------------------------------------------
| Table: reply_templates. Saved answers staff insert into enquiry responses
| and complaint replies. Placeholders ({{customer_name}}, {{reference}},
| {{vehicle}}) are filled in by the website.
*/

export const REPLY_TEMPLATE_CATEGORIES = ['Enquiry', 'Complaint', 'General'];

export const ReplyTemplate = sequelize.define(
  'ReplyTemplate',
  {
    templateId: { field: 'template_id', type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    category: { type: DataTypes.ENUM(...REPLY_TEMPLATE_CATEGORIES), allowNull: false, defaultValue: 'General' },
    subject: { type: DataTypes.STRING(180), allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    isActive: { field: 'is_active', type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { field: 'created_by', type: DataTypes.INTEGER, allowNull: true },
    updatedBy: { field: 'updated_by', type: DataTypes.INTEGER, allowNull: true }
  },
  { ...opts, tableName: 'reply_templates' }
);

/*
|--------------------------------------------------------------------------
| VIVA – Herathge – Financing & Company module – CRUD resource 3:
| Finance Applications
|--------------------------------------------------------------------------
| Table: finance_applications. A customer applies for financing on a
| vehicle. The interest rate and monthly payment are a snapshot taken from
| the active financing configuration at the time of applying.
*/

export const FINANCE_EMPLOYMENT_TYPES = ['Salaried', 'Self-employed', 'Business owner', 'Other'];
export const FINANCE_STATUSES = ['Submitted', 'Under Review', 'Approved in Principle', 'Declined', 'Withdrawn'];

export const FinanceApplication = sequelize.define(
  'FinanceApplication',
  {
    applicationId: { field: 'application_id', type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    reference: { type: DataTypes.STRING(24), allowNull: true, unique: true },
    customerId: { field: 'customer_id', type: DataTypes.INTEGER, allowNull: false },
    vehicleId: { field: 'vehicle_id', type: DataTypes.INTEGER, allowNull: true },
    vehicleReference: { field: 'vehicle_reference', type: DataTypes.STRING(180), allowNull: false },
    configId: { field: 'config_id', type: DataTypes.INTEGER, allowNull: true },
    vehiclePrice: { field: 'vehicle_price', type: DataTypes.DECIMAL(14, 2), allowNull: false },
    downPayment: { field: 'down_payment', type: DataTypes.DECIMAL(14, 2), allowNull: false },
    loanAmount: { field: 'loan_amount', type: DataTypes.DECIMAL(14, 2), allowNull: false },
    termMonths: { field: 'term_months', type: DataTypes.INTEGER, allowNull: false },
    annualInterestRate: { field: 'annual_interest_rate', type: DataTypes.DECIMAL(6, 3), allowNull: false },
    monthlyPayment: { field: 'monthly_payment', type: DataTypes.DECIMAL(14, 2), allowNull: false },
    employmentType: { field: 'employment_type', type: DataTypes.ENUM(...FINANCE_EMPLOYMENT_TYPES), allowNull: false },
    monthlyIncome: { field: 'monthly_income', type: DataTypes.DECIMAL(14, 2), allowNull: false },
    contactPhone: { field: 'contact_phone', type: DataTypes.STRING(30), allowNull: false },
    customerNotes: { field: 'customer_notes', type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM(...FINANCE_STATUSES), allowNull: false, defaultValue: 'Submitted' },
    decisionNote: { field: 'decision_note', type: DataTypes.TEXT, allowNull: true },
    staffNotes: { field: 'staff_notes', type: DataTypes.TEXT, allowNull: true },
    reviewedBy: { field: 'reviewed_by', type: DataTypes.INTEGER, allowNull: true },
    reviewedAt: { field: 'reviewed_at', type: DataTypes.DATE, allowNull: true }
  },
  { ...opts, tableName: 'finance_applications' }
);

/*
|--------------------------------------------------------------------------
| Associations
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| VIVA – Ahamed – Session events (Sessions › "Check activity")
|--------------------------------------------------------------------------
| One row per login, failed login, token refresh, logout, revoke, lockout
| and password reset. Created by migration 202610150001.
*/
export const SESSION_EVENT_TYPES = [
  'login',
  'login_failed',
  'locked',
  'unlocked',
  'refresh',
  'logout',
  'revoked',
  'signed_out_others',
  'password_changed',
  'password_reset',
  'password_reset_requested',
  'deactivated'
];

export const SessionEvent = sequelize.define(
  'SessionEvent',
  {
    eventId: { field: 'event_id', type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sessionId: { field: 'session_id', type: DataTypes.INTEGER, allowNull: true },
    userId: { field: 'user_id', type: DataTypes.INTEGER, allowNull: true },
    actorId: { field: 'actor_id', type: DataTypes.INTEGER, allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    eventType: { field: 'event_type', type: DataTypes.STRING(30), allowNull: false },
    detail: { type: DataTypes.STRING(255), allowNull: true },
    ipAddress: { field: 'ip_address', type: DataTypes.STRING(45), allowNull: true },
    userAgent: { field: 'user_agent', type: DataTypes.STRING(500), allowNull: true },
    deviceLabel: { field: 'device_label', type: DataTypes.STRING(120), allowNull: true }
  },
  {
    ...opts,
    tableName: 'session_events',
    updatedAt: false
  }
);

/*
|--------------------------------------------------------------------------
| VIVA – Ahamed – Password reset tokens ("Forgot password?")
|--------------------------------------------------------------------------
| Only a SHA-256 hash of the emailed token is stored. A token works once
| and expires after PASSWORD_RESET_MINUTES (default 30).
*/
export const PasswordResetToken = sequelize.define(
  'PasswordResetToken',
  {
    tokenId: { field: 'token_id', type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { field: 'user_id', type: DataTypes.INTEGER, allowNull: false },
    tokenHash: { field: 'token_hash', type: DataTypes.STRING(64), allowNull: false },
    expiresAt: { field: 'expires_at', type: DataTypes.DATE, allowNull: false },
    usedAt: { field: 'used_at', type: DataTypes.DATE, allowNull: true },
    ipAddress: { field: 'ip_address', type: DataTypes.STRING(45), allowNull: true }
  },
  {
    ...opts,
    tableName: 'password_reset_tokens',
    updatedAt: false
  }
);

/*
|--------------------------------------------------------------------------
| VIVA – Amri – Staff leave days (test-drive staff availability)
|--------------------------------------------------------------------------
| An Admin marks the days a Staff member is off. A Staff member on leave
| on the booking date cannot be assigned to that test drive.
*/
export const StaffLeave = sequelize.define(
  'StaffLeave',
  {
    leaveId: { field: 'leave_id', type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    staffId: { field: 'staff_id', type: DataTypes.INTEGER, allowNull: false },
    startDate: { field: 'start_date', type: DataTypes.DATEONLY, allowNull: false },
    endDate: { field: 'end_date', type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.STRING(150), allowNull: true },
    createdBy: { field: 'created_by', type: DataTypes.INTEGER, allowNull: true }
  },
  {
    ...opts,
    tableName: 'staff_leave'
  }
);

export function associateExtendedModels({ User, Vehicle, Enquiry, TestDriveBooking, Finance, Session }) {
  Complaint.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
  User.hasMany(Complaint, { foreignKey: 'customerId', as: 'complaints' });

  Complaint.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedStaff' });
  User.hasMany(Complaint, { foreignKey: 'assignedTo', as: 'assignedComplaints' });

  Complaint.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasMany(Complaint, { foreignKey: 'vehicleId', as: 'complaints' });

  Complaint.belongsTo(TestDriveBooking, { foreignKey: 'bookingId', as: 'booking' });
  TestDriveBooking.hasMany(Complaint, { foreignKey: 'bookingId', as: 'complaints' });

  Complaint.belongsTo(Enquiry, { foreignKey: 'enquiryId', as: 'enquiry' });
  Enquiry.hasMany(Complaint, { foreignKey: 'enquiryId', as: 'complaints' });

  Complaint.hasMany(ComplaintMessage, { foreignKey: 'complaintId', as: 'messages' });
  ComplaintMessage.belongsTo(Complaint, { foreignKey: 'complaintId', as: 'complaint' });
  ComplaintMessage.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

  Complaint.hasMany(ComplaintStatusHistory, { foreignKey: 'complaintId', as: 'statusHistory' });
  ComplaintStatusHistory.belongsTo(Complaint, { foreignKey: 'complaintId', as: 'complaint' });
  ComplaintStatusHistory.belongsTo(User, { foreignKey: 'changedBy', as: 'changedByUser' });

  Document.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
  User.hasMany(Document, { foreignKey: 'uploadedBy', as: 'documents' });
  Document.belongsTo(Complaint, { foreignKey: 'complaintId', as: 'complaint' });
  Complaint.hasMany(Document, { foreignKey: 'complaintId', as: 'documents' });
  Document.belongsTo(TestDriveBooking, { foreignKey: 'bookingId', as: 'booking' });
  TestDriveBooking.hasMany(Document, { foreignKey: 'bookingId', as: 'documents' });
  Document.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasMany(Document, { foreignKey: 'vehicleId', as: 'documents' });

  EmailLog.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

  InboundEmail.belongsTo(Complaint, { foreignKey: 'complaintId', as: 'complaint' });
  InboundEmail.belongsTo(Enquiry, { foreignKey: 'enquiryId', as: 'enquiry' });
  Enquiry.hasMany(InboundEmail, { foreignKey: 'enquiryId', as: 'inboundReplies' });

  ActivityLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

  SavedReport.belongsTo(User, { foreignKey: 'createdBy', as: 'owner' });

  ReplyTemplate.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  ReplyTemplate.belongsTo(User, { foreignKey: 'updatedBy', as: 'editor' });

  FinanceApplication.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
  User.hasMany(FinanceApplication, { foreignKey: 'customerId', as: 'financeApplications' });
  FinanceApplication.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });
  FinanceApplication.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
  Vehicle.hasMany(FinanceApplication, { foreignKey: 'vehicleId', as: 'financeApplications' });
  if (Finance) {
    FinanceApplication.belongsTo(Finance, { foreignKey: 'configId', as: 'configuration' });
  }
  FinanceApplication.hasMany(Document, { foreignKey: 'financeApplicationId', as: 'documents' });
  Document.belongsTo(FinanceApplication, { foreignKey: 'financeApplicationId', as: 'financeApplication' });

  SessionEvent.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  SessionEvent.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
  if (Session) {
    SessionEvent.belongsTo(Session, { foreignKey: 'sessionId', as: 'session' });
    Session.hasMany(SessionEvent, { foreignKey: 'sessionId', as: 'events' });
  }
  PasswordResetToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  StaffLeave.belongsTo(User, { foreignKey: 'staffId', as: 'staff' });
  User.hasMany(StaffLeave, { foreignKey: 'staffId', as: 'leaveDays' });
  StaffLeave.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
}
