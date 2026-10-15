'use strict';

/*
|--------------------------------------------------------------------------
| 16-CRUD completion migration (October 2026)
|--------------------------------------------------------------------------
|
| Adds the database pieces needed so that every team member owns four
| complete CRUD resources:
|
|   Amri     – Wishlists          : new column wishlists.note (UPDATE)
|   Naaziq   – Reply Templates    : new table reply_templates (full CRUD)
|   Herathge – Finance Applications: new table finance_applications (full CRUD)
|   Herathge – Customer Documents : documents can now be linked to a finance
|                                   application ("Finance Document" category)
|
| Additive only: no existing table, column or row is removed or rewritten,
| so it is safe on the live XAMPP database. Compatible with MySQL 8 and
| MariaDB 10.4. `down()` removes only what this file adds.
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
  references: { model: table, key: column },
  onUpdate: 'CASCADE',
  onDelete
});

const OLD_DOCUMENT_CATEGORIES = ['Complaint Evidence', 'Booking Document', 'Vehicle Document', 'Identity Document', 'Other'];
const NEW_DOCUMENT_CATEGORIES = [...OLD_DOCUMENT_CATEGORIES, 'Finance Document'];

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Boolean(description[column]);
}

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  return tables.map((name) => (typeof name === 'string' ? name : name.tableName)).includes(table);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    | Amri – Wishlists: UPDATE operation.
    | A customer can keep a private note on each saved vehicle
    | (e.g. "ask about service history"). Nullable, so existing rows are
    | untouched.
    */
    if (!(await columnExists(queryInterface, 'wishlists', 'note'))) {
      await queryInterface.addColumn('wishlists', 'note', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'vehicle_id'
      });
    }

    /*
    | Naaziq – Reply Templates (CREATE / READ / UPDATE / DELETE).
    | Saved, reusable answers staff insert when responding to enquiries
    | and complaints. Placeholders such as {{customer_name}} are filled in
    | by the website when the template is used.
    */
    if (!(await tableExists(queryInterface, 'reply_templates'))) {
      await queryInterface.createTable('reply_templates', {
        template_id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        title: { type: Sequelize.STRING(120), allowNull: false },
        category: {
          type: Sequelize.ENUM('Enquiry', 'Complaint', 'General'),
          allowNull: false,
          defaultValue: 'General'
        },
        subject: { type: Sequelize.STRING(180), allowNull: true },
        body: { type: Sequelize.TEXT, allowNull: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
        updated_by: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
        ...timestamps(Sequelize)
      });

      await queryInterface.addIndex('reply_templates', ['title'], { name: 'reply_templates_title_unique', unique: true });
      await queryInterface.addIndex('reply_templates', ['category', 'is_active'], { name: 'reply_templates_category_active' });
    }

    /*
    | Herathge – Finance Applications (CREATE / READ / UPDATE / DELETE).
    | A customer applies for vehicle financing using the active financing
    | configuration; staff review it. The monthly payment and interest rate
    | are stored as a snapshot so later configuration changes never alter
    | an application that was already submitted.
    */
    if (!(await tableExists(queryInterface, 'finance_applications'))) {
      await queryInterface.createTable('finance_applications', {
        application_id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        reference: { type: Sequelize.STRING(24), allowNull: true },
        customer_id: fk(Sequelize, 'users', 'user_id', 'CASCADE', false),
        vehicle_id: fk(Sequelize, 'vehicles', 'vehicle_id', 'SET NULL'),
        vehicle_reference: { type: Sequelize.STRING(180), allowNull: false },
        config_id: fk(Sequelize, 'financing_configs', 'config_id', 'SET NULL'),
        vehicle_price: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        down_payment: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        loan_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        term_months: { type: Sequelize.INTEGER, allowNull: false },
        annual_interest_rate: { type: Sequelize.DECIMAL(6, 3), allowNull: false },
        monthly_payment: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        employment_type: {
          type: Sequelize.ENUM('Salaried', 'Self-employed', 'Business owner', 'Other'),
          allowNull: false
        },
        monthly_income: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        contact_phone: { type: Sequelize.STRING(30), allowNull: false },
        customer_notes: { type: Sequelize.TEXT, allowNull: true },
        status: {
          type: Sequelize.ENUM('Submitted', 'Under Review', 'Approved in Principle', 'Declined', 'Withdrawn'),
          allowNull: false,
          defaultValue: 'Submitted'
        },
        decision_note: { type: Sequelize.TEXT, allowNull: true },
        staff_notes: { type: Sequelize.TEXT, allowNull: true },
        reviewed_by: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
        reviewed_at: { type: Sequelize.DATE, allowNull: true },
        ...timestamps(Sequelize)
      });

      await queryInterface.addIndex('finance_applications', ['reference'], { name: 'finance_applications_reference_unique', unique: true });
      await queryInterface.addIndex('finance_applications', ['customer_id'], { name: 'finance_applications_customer' });
      await queryInterface.addIndex('finance_applications', ['status', 'created_at'], { name: 'finance_applications_status_created' });
      await queryInterface.addIndex('finance_applications', ['vehicle_id'], { name: 'finance_applications_vehicle' });

      await queryInterface.sequelize.query(
        'ALTER TABLE finance_applications ADD CONSTRAINT chk_finance_amounts CHECK (' +
          'vehicle_price > 0 AND down_payment >= 0 AND down_payment < vehicle_price AND ' +
          'loan_amount > 0 AND term_months BETWEEN 1 AND 360 AND monthly_income >= 0)'
      );
    }

    /*
    | Herathge – Customer Documents: a document (payslip, bank statement,
    | NIC) can be attached to a finance application.
    */
    if (!(await columnExists(queryInterface, 'documents', 'finance_application_id'))) {
      await queryInterface.addColumn('documents', 'finance_application_id', {
        ...fk(Sequelize, 'finance_applications', 'application_id', 'SET NULL'),
        after: 'vehicle_id'
      });
      await queryInterface.addIndex('documents', ['finance_application_id'], { name: 'documents_finance_application' });
    }

    await queryInterface.changeColumn('documents', 'category', {
      type: Sequelize.ENUM(...NEW_DOCUMENT_CATEGORIES),
      allowNull: false,
      defaultValue: 'Other'
    });
  },

  async down(queryInterface, Sequelize) {
    // Documents: move any finance documents back to "Other" before shrinking the ENUM.
    await queryInterface.sequelize.query("UPDATE documents SET category = 'Other' WHERE category = 'Finance Document'");
    await queryInterface.changeColumn('documents', 'category', {
      type: Sequelize.ENUM(...OLD_DOCUMENT_CATEGORIES),
      allowNull: false,
      defaultValue: 'Other'
    });

    if (await columnExists(queryInterface, 'documents', 'finance_application_id')) {
      await queryInterface.removeIndex('documents', 'documents_finance_application').catch(() => {});
      const [constraints] = await queryInterface.sequelize.query(
        "SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'finance_application_id' AND REFERENCED_TABLE_NAME IS NOT NULL"
      );
      for (const { name } of constraints) {
        await queryInterface.removeConstraint('documents', name);
      }
      await queryInterface.removeColumn('documents', 'finance_application_id');
    }

    await queryInterface.dropTable('finance_applications');
    await queryInterface.dropTable('reply_templates');

    if (await columnExists(queryInterface, 'wishlists', 'note')) {
      await queryInterface.removeColumn('wishlists', 'note');
    }
  }
};
