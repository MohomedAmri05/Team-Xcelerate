import {
  DataTypes
} from 'sequelize';

import {
  sequelize
} from '../config/db.js';

const TestDriveBooking =
  sequelize.define(
    'TestDriveBooking',
    {
      bookingId: {
        field: 'booking_id',
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },

      customerId: {
        field: 'customer_id',
        type: DataTypes.INTEGER,
        allowNull: false
      },

      vehicleId: {
        field: 'vehicle_id',
        type: DataTypes.INTEGER,
        allowNull: true
      },

      vehicleReference: {
        field: 'vehicle_reference',
        type: DataTypes.STRING(180),
        allowNull: false
      },

      preferredDate: {
        field: 'preferred_date',
        type: DataTypes.DATEONLY,
        allowNull: false
      },

      preferredTime: {
        field: 'preferred_time',
        type: DataTypes.TIME,
        allowNull: false
      },

      customerNote: {
        field: 'customer_note',
        type: DataTypes.TEXT,
        allowNull: true
      },

      staffNote: {
        field: 'staff_note',
        type: DataTypes.TEXT,
        allowNull: true
      },

      status: {
        type: DataTypes.ENUM(
          'Pending',
          'Confirmed',
          'Completed',
          'Cancelled'
        ),
        allowNull: false,
        defaultValue: 'Pending'
      },

      assignedTo: {
        field: 'assigned_to',
        type: DataTypes.INTEGER,
        allowNull: true
      },

      confirmedAt: {
        field: 'confirmed_at',
        type: DataTypes.DATE,
        allowNull: true
      },

      completedAt: {
        field: 'completed_at',
        type: DataTypes.DATE,
        allowNull: true
      },

      cancelledAt: {
        field: 'cancelled_at',
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'test_drive_bookings',
      underscored: true,
      timestamps: true
    }
  );

export default TestDriveBooking;