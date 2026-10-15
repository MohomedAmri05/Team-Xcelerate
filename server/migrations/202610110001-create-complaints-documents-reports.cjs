'use strict';

/*
|--------------------------------------------------------------------------
| Complaints, Documents, Email Delivery, Activity Audit and Saved Reports
|--------------------------------------------------------------------------
|
| Additive migration. It does not drop, rename or rewrite any existing table
| or column, so it is safe to run on a database that already holds live
| High Street data. Every new table is compatible with MySQL 8 and with the
| MariaDB 10.4 server bundled with XAMPP.
|
*/

const timestamps = (Sequelize) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
  }
});

const fk = (Sequelize, table, column, onDelete, allowNull = true) => ({
  type: Sequelize.INTEGER,
  allowNull,
  references: {
    model: table,
    key: column
  },
  onUpdate: 'CASCADE',
  onDelete
});

async function indexExists(queryInterface, table, name) {
  const indexes = await queryInterface.showIndex(table);
  return indexes.some((index) => index.name === name);
}

/*
 * Adds an index only when no existing index already starts with the same
 * columns (so indexes created by earlier migrations are reused, never
 * duplicated). New indexes use the "hs26_" prefix so the down migration
 * removes only indexes created here.
 */
async function addIndexIfMissing(queryInterface, table, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(table);

  const covered = indexes.some((index) => {
    const columns = (index.fields || []).map((field) => field.attribute);

    return fields.every((field, position) => columns[position] === field);
  });

  if (!covered && !indexes.some((index) => index.name === name)) {
    await queryInterface.addIndex(table, fields, { name, ...options });
  }
}

const SUPPORTING_INDEXES = [
  ['vehicles', ['make', 'model'], 'hs26_vehicles_make_model'],
  ['vehicles', ['created_at'], 'hs26_vehicles_created_at'],
  ['enquiries', ['created_at'], 'hs26_enquiries_created_at'],
  ['test_drive_bookings', ['status', 'preferred_date'], 'hs26_bookings_status_date'],
  ['admin_sessions', ['created_at'], 'hs26_sessions_created_at']
];

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Boolean(description[column]);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    | Staff permission for the complaint module.
    */
    if (!(await columnExists(queryInterface, 'staff_permissions', 'can_manage_complaints'))) {
      await queryInterface.addColumn('staff_permissions', 'can_manage_complaints', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        after: 'can_manage_enquiries'
      });
    }

    /*
    | Complaints
    */
    await queryInterface.createTable('complaints', {
      complaint_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      reference: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true
      },
      customer_id: fk(Sequelize, 'users', 'user_id', 'RESTRICT', false),
      category: {
        type: Sequelize.ENUM(
          'Vehicle Condition',
          'Test Drive',
          'Enquiry Handling',
          'Staff Conduct',
          'Website',
          'Financing',
          'Other'
        ),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(180),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      priority: {
        type: Sequelize.ENUM('Low', 'Medium', 'High', 'Urgent'),
        allowNull: false,
        defaultValue: 'Medium'
      },
      status: {
        type: Sequelize.ENUM(
          'Submitted',
          'Under Review',
          'In Progress',
          'Resolved',
          'Closed'
        ),
        allowNull: false,
        defaultValue: 'Submitted'
      },
      vehicle_id: fk(Sequelize, 'vehicles', 'vehicle_id', 'SET NULL'),
      booking_id: fk(Sequelize, 'test_drive_bookings', 'booking_id', 'SET NULL'),
      enquiry_id: fk(Sequelize, 'enquiries', 'enquiry_id', 'SET NULL'),
      assigned_to: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      resolution_summary: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      reopened_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      last_activity_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      ...timestamps(Sequelize)
    });

    await queryInterface.addIndex('complaints', ['status'], { name: 'complaints_status' });
    await queryInterface.addIndex('complaints', ['category'], { name: 'complaints_category' });
    await queryInterface.addIndex('complaints', ['customer_id'], { name: 'complaints_customer_id' });
    await queryInterface.addIndex('complaints', ['assigned_to'], { name: 'complaints_assigned_to' });
    await queryInterface.addIndex('complaints', ['created_at'], { name: 'complaints_created_at' });

    /*
    | Complaint conversation (customer replies, staff responses,
    | internal notes and inbound email replies).
    */
    await queryInterface.createTable('complaint_messages', {
      message_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      complaint_id: fk(Sequelize, 'complaints', 'complaint_id', 'CASCADE', false),
      author_id: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
      author_role: {
        type: Sequelize.ENUM('Customer', 'Staff', 'Admin', 'System', 'Email'),
        allowNull: false
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      is_internal: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      source: {
        type: Sequelize.ENUM('Web', 'Email'),
        allowNull: false,
        defaultValue: 'Web'
      },
      ...timestamps(Sequelize)
    });

    await queryInterface.addIndex('complaint_messages', ['complaint_id', 'created_at'], {
      name: 'complaint_messages_complaint_created'
    });

    /*
    | Complaint status audit trail
    */
    await queryInterface.createTable('complaint_status_history', {
      history_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      complaint_id: fk(Sequelize, 'complaints', 'complaint_id', 'CASCADE', false),
      from_status: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      to_status: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      changed_by: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
      note: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('complaint_status_history', ['complaint_id'], {
      name: 'complaint_status_history_complaint_id'
    });

    /*
    | Private documents. Files live in server/storage/documents (never in
    | the public uploads folder); this table holds their metadata.
    */
    await queryInterface.createTable('documents', {
      document_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      uploaded_by: fk(Sequelize, 'users', 'user_id', 'RESTRICT', false),
      category: {
        type: Sequelize.ENUM(
          'Complaint Evidence',
          'Booking Document',
          'Vehicle Document',
          'Identity Document',
          'Other'
        ),
        allowNull: false,
        defaultValue: 'Other'
      },
      complaint_id: fk(Sequelize, 'complaints', 'complaint_id', 'CASCADE'),
      booking_id: fk(Sequelize, 'test_drive_bookings', 'booking_id', 'CASCADE'),
      vehicle_id: fk(Sequelize, 'vehicles', 'vehicle_id', 'CASCADE'),
      original_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      storage_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      extension: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      checksum_sha256: {
        type: Sequelize.CHAR(64),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      visibility: {
        type: Sequelize.ENUM('Owner', 'Staff'),
        allowNull: false,
        defaultValue: 'Owner'
      },
      ...timestamps(Sequelize)
    });

    await queryInterface.addIndex('documents', ['uploaded_by'], { name: 'documents_uploaded_by' });
    await queryInterface.addIndex('documents', ['complaint_id'], { name: 'documents_complaint_id' });
    await queryInterface.addIndex('documents', ['booking_id'], { name: 'documents_booking_id' });
    await queryInterface.addIndex('documents', ['vehicle_id'], { name: 'documents_vehicle_id' });
    await queryInterface.addIndex('documents', ['category'], { name: 'documents_category' });

    // A document belongs to at most one record (complaint, booking or vehicle).
    await queryInterface.sequelize.query(
      'ALTER TABLE documents ADD CONSTRAINT chk_documents_single_link CHECK (' +
        '(CASE WHEN complaint_id IS NULL THEN 0 ELSE 1 END) + ' +
        '(CASE WHEN booking_id IS NULL THEN 0 ELSE 1 END) + ' +
        '(CASE WHEN vehicle_id IS NULL THEN 0 ELSE 1 END) <= 1)'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE documents ADD CONSTRAINT chk_documents_size CHECK (size_bytes > 0)'
    );

    /*
    | Outbound email delivery log / retry queue
    */
    await queryInterface.createTable('email_logs', {
      email_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      message_key: {
        type: Sequelize.STRING(191),
        allowNull: false,
        unique: true
      },
      recipient: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      reply_to: {
        type: Sequelize.STRING(150),
        allowNull: true
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      template: {
        type: Sequelize.STRING(60),
        allowNull: false
      },
      related_type: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      related_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('Queued', 'Sending', 'Accepted', 'Failed', 'Preview'),
        allowNull: false,
        defaultValue: 'Queued'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3
      },
      next_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_error: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      provider_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      accepted_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      payload: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
      ...timestamps(Sequelize)
    });

    await queryInterface.addIndex('email_logs', ['status', 'next_attempt_at'], {
      name: 'email_logs_status_next_attempt'
    });
    await queryInterface.addIndex('email_logs', ['related_type', 'related_id'], {
      name: 'email_logs_related'
    });

    /*
    | Inbound email replies (received through the provider webhook)
    */
    await queryInterface.createTable('inbound_emails', {
      inbound_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      provider_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      from_address: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('Matched', 'Unmatched', 'Rejected'),
        allowNull: false
      },
      complaint_id: fk(Sequelize, 'complaints', 'complaint_id', 'SET NULL'),
      enquiry_id: fk(Sequelize, 'enquiries', 'enquiry_id', 'SET NULL'),
      complaint_message_id: fk(Sequelize, 'complaint_messages', 'message_id', 'SET NULL'),
      received_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      ...timestamps(Sequelize)
    });

    await queryInterface.addIndex('inbound_emails', ['status'], { name: 'inbound_emails_status' });

    /*
    | Activity / audit log
    */
    await queryInterface.createTable('activity_logs', {
      activity_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      actor_id: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
      actor_role: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      action: {
        type: Sequelize.STRING(60),
        allowNull: false
      },
      entity_type: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      summary: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('activity_logs', ['created_at'], { name: 'activity_logs_created_at' });
    await queryInterface.addIndex('activity_logs', ['entity_type', 'entity_id'], {
      name: 'activity_logs_entity'
    });

    /*
    | Saved report definitions
    */
    await queryInterface.createTable('saved_reports', {
      report_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      report_type: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      filters: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      created_by: fk(Sequelize, 'users', 'user_id', 'CASCADE', false),
      last_run_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      ...timestamps(Sequelize)
    });

    await queryInterface.addIndex('saved_reports', ['created_by', 'name'], {
      name: 'saved_reports_owner_name',
      unique: true
    });

    /*
    | Supporting indexes for search, filtering and reports on the
    | existing tables (added only if they are missing).
    */
    for (const [table, fields, name] of SUPPORTING_INDEXES) {
      await addIndexIfMissing(queryInterface, table, fields, name);
    }
  },

  async down(queryInterface) {
    for (const table of [
      'saved_reports',
      'activity_logs',
      'inbound_emails',
      'email_logs',
      'documents',
      'complaint_status_history',
      'complaint_messages',
      'complaints'
    ]) {
      await queryInterface.dropTable(table);
    }

    // Only indexes created by this migration (hs26_ prefix) are removed.
    for (const [table, , name] of SUPPORTING_INDEXES) {
      if (await indexExists(queryInterface, table, name)) {
        await queryInterface.removeIndex(table, name);
      }
    }

    if (await columnExists(queryInterface, 'staff_permissions', 'can_manage_complaints')) {
      await queryInterface.removeColumn('staff_permissions', 'can_manage_complaints');
    }
  }
};
