'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /*
    |--------------------------------------------------------------------------
    | Staff Permissions
    |--------------------------------------------------------------------------
    */

    await queryInterface.createTable(
      'staff_permissions',
      {
        permission_id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },

        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,

          references: {
            model: 'users',
            key: 'user_id'
          },

          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },

        can_manage_inventory: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },

        can_manage_enquiries: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },

        can_view_assigned_contacts: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },

        can_archive_records: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },

        can_view_limited_analytics: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },

        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },

        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      }
    );

    await queryInterface.addIndex(
      'staff_permissions',
      ['user_id'],
      {
        unique: true,
        name: 'staff_permissions_user_unique'
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Customer Ownership for Enquiries
    |--------------------------------------------------------------------------
    */

    await queryInterface.addColumn(
      'enquiries',
      'customer_id',
      {
        type: Sequelize.INTEGER,
        allowNull: true,

        references: {
          model: 'users',
          key: 'user_id'
        },

        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Staff Assignment for Enquiries
    |--------------------------------------------------------------------------
    */

    await queryInterface.addColumn(
      'enquiries',
      'assigned_to',
      {
        type: Sequelize.INTEGER,
        allowNull: true,

        references: {
          model: 'users',
          key: 'user_id'
        },

        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }
    );

    await queryInterface.addColumn(
      'enquiries',
      'assigned_at',
      {
        type: Sequelize.DATE,
        allowNull: true
      }
    );

    await queryInterface.addColumn(
      'enquiries',
      'assigned_by',
      {
        type: Sequelize.INTEGER,
        allowNull: true,

        references: {
          model: 'users',
          key: 'user_id'
        },

        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Enquiry Indexes
    |--------------------------------------------------------------------------
    */

    await queryInterface.addIndex(
      'enquiries',
      ['customer_id'],
      {
        name: 'enquiries_customer_index'
      }
    );

    await queryInterface.addIndex(
      'enquiries',
      ['assigned_to'],
      {
        name: 'enquiries_assigned_to_index'
      }
    );

    await queryInterface.addIndex(
      'enquiries',
      ['assigned_by'],
      {
        name: 'enquiries_assigned_by_index'
      }
    );

    await queryInterface.addIndex(
      'enquiries',
      ['assigned_to', 'status'],
      {
        name: 'enquiries_staff_status_index'
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'enquiries',
      'enquiries_staff_status_index'
    );

    await queryInterface.removeIndex(
      'enquiries',
      'enquiries_assigned_by_index'
    );

    await queryInterface.removeIndex(
      'enquiries',
      'enquiries_assigned_to_index'
    );

    await queryInterface.removeIndex(
      'enquiries',
      'enquiries_customer_index'
    );

    await queryInterface.removeColumn(
      'enquiries',
      'assigned_by'
    );

    await queryInterface.removeColumn(
      'enquiries',
      'assigned_at'
    );

    await queryInterface.removeColumn(
      'enquiries',
      'assigned_to'
    );

    await queryInterface.removeColumn(
      'enquiries',
      'customer_id'
    );

    await queryInterface.dropTable(
      'staff_permissions'
    );
  }
};