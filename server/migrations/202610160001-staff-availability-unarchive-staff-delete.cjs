'use strict';

/*
|--------------------------------------------------------------------------
| Staff availability, Unarchive and permanent Staff deletion (Oct 2026)
|--------------------------------------------------------------------------
|
|   Amri – Test-drive bookings: staff availability
|     staff_leave                    days an Admin marks a Staff member as
|                                    off (leave, sick, training …). Together
|                                    with the automatic clash check (another
|                                    Pending/Confirmed test drive at the same
|                                    date and time) it decides who can be
|                                    assigned to a booking.
|
|   Amri – Vehicles: Unarchive
|     vehicles.status_before_archive the status the vehicle had when it was
|                                    archived, so "Unarchive" can put it back
|                                    (Draft / Available / Sold).
|
|   Ahamed – Staff Permissions: permanent "Delete staff"
|     enquiry_responses.admin_id     NOT NULL → NULL, ON DELETE SET NULL
|     documents.uploaded_by          NOT NULL → NULL, ON DELETE SET NULL
|                                    so the responses and files a deleted
|                                    Staff member made are KEPT and shown as
|                                    "Deleted staff member" instead of
|                                    blocking the delete.
|
| Additive only: existing rows are kept. Works on MySQL 8 and MariaDB 10.4.
| down() removes only what this file adds.
|
*/

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Boolean(description[column]);
}

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  return tables.map((name) => (typeof name === 'string' ? name : name.tableName)).includes(table);
}

async function dropForeignKeys(queryInterface, table, column) {
  const [constraints] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
        AND REFERENCED_TABLE_NAME IS NOT NULL`
  );

  for (const { name } of constraints) {
    await queryInterface.removeConstraint(table, name);
  }
}

async function relinkUserColumn(queryInterface, Sequelize, table, column, { allowNull, onDelete }) {
  await dropForeignKeys(queryInterface, table, column);

  await queryInterface.changeColumn(table, column, {
    type: Sequelize.INTEGER,
    allowNull
  });

  await queryInterface.addConstraint(table, {
    fields: [column],
    type: 'foreign key',
    name: `${table}_${column}_fk`,
    references: { table: 'users', field: 'user_id' },
    onUpdate: 'CASCADE',
    onDelete
  });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    | Staff leave days
    */
    if (!(await tableExists(queryInterface, 'staff_leave'))) {
      await queryInterface.createTable('staff_leave', {
        leave_id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        staff_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'user_id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        start_date: { type: Sequelize.DATEONLY, allowNull: false },
        end_date: { type: Sequelize.DATEONLY, allowNull: false },
        reason: { type: Sequelize.STRING(150), allowNull: true },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'user_id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      });
      await queryInterface.addIndex('staff_leave', ['staff_id', 'start_date', 'end_date'], { name: 'staff_leave_staff_dates' });
    }

    /*
    | Vehicles – remember the status before archiving
    */
    if (!(await columnExists(queryInterface, 'vehicles', 'status_before_archive'))) {
      await queryInterface.addColumn('vehicles', 'status_before_archive', {
        type: Sequelize.STRING(20),
        allowNull: true
      });
    }

    /*
    | Permanent Staff deletion keeps their responses and uploaded files
    */
    await relinkUserColumn(queryInterface, Sequelize, 'enquiry_responses', 'admin_id', { allowNull: true, onDelete: 'SET NULL' });
    await relinkUserColumn(queryInterface, Sequelize, 'documents', 'uploaded_by', { allowNull: true, onDelete: 'SET NULL' });
  },

  async down(queryInterface, Sequelize) {
    // NOT NULL can only come back when no row was left without an author.
    for (const [table, column, onDelete] of [
      ['documents', 'uploaded_by', 'RESTRICT'],
      ['enquiry_responses', 'admin_id', 'NO ACTION']
    ]) {
      const [[{ missing }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) AS missing FROM ${table} WHERE ${column} IS NULL`);
      await relinkUserColumn(queryInterface, Sequelize, table, column, { allowNull: Number(missing) > 0, onDelete });
    }

    if (await columnExists(queryInterface, 'vehicles', 'status_before_archive')) {
      await queryInterface.removeColumn('vehicles', 'status_before_archive');
    }

    if (await tableExists(queryInterface, 'staff_leave')) {
      await queryInterface.dropTable('staff_leave');
    }
  }
};
