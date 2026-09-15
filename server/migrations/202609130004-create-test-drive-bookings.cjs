'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'test_drive_bookings',
      {
        booking_id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },

        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'user_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },

        vehicle_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'vehicles',
            key: 'vehicle_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },

        vehicle_reference: {
          type: Sequelize.STRING(180),
          allowNull: false
        },

        preferred_date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },

        preferred_time: {
          type: Sequelize.TIME,
          allowNull: false
        },

        customer_note: {
          type: Sequelize.TEXT,
          allowNull: true
        },

        staff_note: {
          type: Sequelize.TEXT,
          allowNull: true
        },

        status: {
          type: Sequelize.ENUM(
            'Pending',
            'Confirmed',
            'Completed',
            'Cancelled'
          ),
          allowNull: false,
          defaultValue: 'Pending'
        },

        assigned_to: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'user_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },

        confirmed_at: {
          type: Sequelize.DATE,
          allowNull: true
        },

        completed_at: {
          type: Sequelize.DATE,
          allowNull: true
        },

        cancelled_at: {
          type: Sequelize.DATE,
          allowNull: true
        },

        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            'CURRENT_TIMESTAMP'
          )
        },

        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            'CURRENT_TIMESTAMP'
          )
        }
      }
    );

    await queryInterface.addIndex(
      'test_drive_bookings',
      ['customer_id'],
      {
        name: 'idx_test_drive_customer'
      }
    );

    await queryInterface.addIndex(
      'test_drive_bookings',
      ['vehicle_id'],
      {
        name: 'idx_test_drive_vehicle'
      }
    );

    await queryInterface.addIndex(
      'test_drive_bookings',
      ['assigned_to'],
      {
        name: 'idx_test_drive_assigned_to'
      }
    );

    await queryInterface.addIndex(
      'test_drive_bookings',
      ['status'],
      {
        name: 'idx_test_drive_status'
      }
    );

    await queryInterface.addIndex(
      'test_drive_bookings',
      ['preferred_date'],
      {
        name: 'idx_test_drive_preferred_date'
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      'test_drive_bookings'
    );
  }
};