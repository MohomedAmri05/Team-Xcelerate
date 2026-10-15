'use strict';

/*
|--------------------------------------------------------------------------
| Users, Sessions, Staff Permissions and per-vehicle financing (Oct 2026)
|--------------------------------------------------------------------------
|
|   Ahamed – Users
|     users.must_change_password   temporary password set by an Admin must
|                                  be changed by the user at first login
|     users.failed_login_count     consecutive wrong passwords (lockout)
|     users.locked_until           sign-in blocked until this time
|     users.password_changed_at    when the owner last changed the password
|     password_reset_tokens        one-time "Forgot password?" links
|
|   Ahamed – Sessions ("Check activity")
|     admin_sessions.last_seen_at  last request made with the session
|     admin_sessions.refresh_count how many times the token was rotated
|     admin_sessions.ended_reason  logout / revoked / password_changed / …
|     admin_sessions.ended_by      who ended it (user or Admin)
|     admin_sessions.device_label  "Chrome 129 on Windows 10/11"
|     session_events               login, refresh, logout, revoke and
|                                  failed-login history
|
|   Ahamed – Staff Permissions: two new permissions
|     staff_permissions.can_manage_bookings  (copied from Manage enquiries,
|                                             so nobody loses access)
|     staff_permissions.can_export_reports   (copied from View limited
|                                             analytics, for the same reason)
|
|   Herathge – Financing Configurations
|     financing_configs.vehicle_id  a plan can belong to ONE vehicle;
|                                   NULL = the general plan for all others
|
| Additive only: existing rows are kept. Works on MySQL 8 and MariaDB 10.4.
| down() removes only what this file adds.
|
*/

const fk = (Sequelize, table, column, onDelete, allowNull = true) => ({
  type: Sequelize.INTEGER,
  allowNull,
  references: { model: table, key: column },
  onUpdate: 'CASCADE',
  onDelete
});

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Boolean(description[column]);
}

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  return tables.map((name) => (typeof name === 'string' ? name : name.tableName)).includes(table);
}

async function addColumnOnce(queryInterface, table, column, definition) {
  if (!(await columnExists(queryInterface, table, column))) {
    await queryInterface.addColumn(table, column, definition);
  }
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

async function removeColumnOnce(queryInterface, table, column, { index, foreignKey = false } = {}) {
  if (!(await columnExists(queryInterface, table, column))) {
    return;
  }

  if (index) {
    await queryInterface.removeIndex(table, index).catch(() => {});
  }

  if (foreignKey) {
    await dropForeignKeys(queryInterface, table, column);
  }

  await queryInterface.removeColumn(table, column);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    | Users
    */
    await addColumnOnce(queryInterface, 'users', 'must_change_password', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await addColumnOnce(queryInterface, 'users', 'failed_login_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await addColumnOnce(queryInterface, 'users', 'locked_until', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await addColumnOnce(queryInterface, 'users', 'password_changed_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    if (!(await tableExists(queryInterface, 'password_reset_tokens'))) {
      await queryInterface.createTable('password_reset_tokens', {
        token_id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: fk(Sequelize, 'users', 'user_id', 'CASCADE', false),
        token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        used_at: { type: Sequelize.DATE, allowNull: true },
        ip_address: { type: Sequelize.STRING(45), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      });
      await queryInterface.addIndex('password_reset_tokens', ['user_id', 'used_at'], { name: 'password_reset_tokens_user' });
    }

    /*
    | Sessions
    */
    await addColumnOnce(queryInterface, 'admin_sessions', 'last_seen_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await addColumnOnce(queryInterface, 'admin_sessions', 'refresh_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await addColumnOnce(queryInterface, 'admin_sessions', 'ended_reason', {
      type: Sequelize.STRING(30),
      allowNull: true
    });
    if (!(await columnExists(queryInterface, 'admin_sessions', 'ended_by'))) {
      await queryInterface.addColumn('admin_sessions', 'ended_by', fk(Sequelize, 'users', 'user_id', 'SET NULL'));
    }
    await addColumnOnce(queryInterface, 'admin_sessions', 'device_label', {
      type: Sequelize.STRING(120),
      allowNull: true
    });

    if (!(await tableExists(queryInterface, 'session_events'))) {
      await queryInterface.createTable('session_events', {
        event_id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        session_id: fk(Sequelize, 'admin_sessions', 'session_id', 'CASCADE'),
        user_id: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
        actor_id: fk(Sequelize, 'users', 'user_id', 'SET NULL'),
        email: { type: Sequelize.STRING(150), allowNull: true },
        event_type: { type: Sequelize.STRING(30), allowNull: false },
        detail: { type: Sequelize.STRING(255), allowNull: true },
        ip_address: { type: Sequelize.STRING(45), allowNull: true },
        user_agent: { type: Sequelize.STRING(500), allowNull: true },
        device_label: { type: Sequelize.STRING(120), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      });
      await queryInterface.addIndex('session_events', ['session_id'], { name: 'session_events_session' });
      await queryInterface.addIndex('session_events', ['user_id', 'created_at'], { name: 'session_events_user_time' });
      await queryInterface.addIndex('session_events', ['event_type', 'created_at'], { name: 'session_events_type_time' });
    }

    /*
    | Staff permissions – copy the old rule into the new columns so that no
    | Staff member loses access on the day of the upgrade.
    */
    if (!(await columnExists(queryInterface, 'staff_permissions', 'can_manage_bookings'))) {
      await queryInterface.addColumn('staff_permissions', 'can_manage_bookings', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      await queryInterface.sequelize.query('UPDATE staff_permissions SET can_manage_bookings = can_manage_enquiries');
    }

    if (!(await columnExists(queryInterface, 'staff_permissions', 'can_export_reports'))) {
      await queryInterface.addColumn('staff_permissions', 'can_export_reports', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      await queryInterface.sequelize.query('UPDATE staff_permissions SET can_export_reports = can_view_limited_analytics');
    }

    /*
    | Financing configurations – optional link to one vehicle
    */
    if (!(await columnExists(queryInterface, 'financing_configs', 'vehicle_id'))) {
      await queryInterface.addColumn('financing_configs', 'vehicle_id', fk(Sequelize, 'vehicles', 'vehicle_id', 'CASCADE'));
      await queryInterface.addIndex('financing_configs', ['vehicle_id', 'is_active'], { name: 'financing_configs_vehicle_active' });
    }
  },

  async down(queryInterface) {
    await removeColumnOnce(queryInterface, 'financing_configs', 'vehicle_id', {
      index: 'financing_configs_vehicle_active',
      foreignKey: true
    });

    await removeColumnOnce(queryInterface, 'staff_permissions', 'can_export_reports');
    await removeColumnOnce(queryInterface, 'staff_permissions', 'can_manage_bookings');

    if (await tableExists(queryInterface, 'session_events')) {
      await queryInterface.dropTable('session_events');
    }

    await removeColumnOnce(queryInterface, 'admin_sessions', 'device_label');
    await removeColumnOnce(queryInterface, 'admin_sessions', 'ended_by', { foreignKey: true });
    await removeColumnOnce(queryInterface, 'admin_sessions', 'ended_reason');
    await removeColumnOnce(queryInterface, 'admin_sessions', 'refresh_count');
    await removeColumnOnce(queryInterface, 'admin_sessions', 'last_seen_at');

    if (await tableExists(queryInterface, 'password_reset_tokens')) {
      await queryInterface.dropTable('password_reset_tokens');
    }

    await removeColumnOnce(queryInterface, 'users', 'password_changed_at');
    await removeColumnOnce(queryInterface, 'users', 'locked_until');
    await removeColumnOnce(queryInterface, 'users', 'failed_login_count');
    await removeColumnOnce(queryInterface, 'users', 'must_change_password');
  }
};
