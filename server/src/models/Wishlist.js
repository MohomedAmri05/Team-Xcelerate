import {
  DataTypes
} from 'sequelize';

import {
  sequelize
} from '../config/db.js';

const Wishlist = sequelize.define(
  'Wishlist',
  {
    wishlistId: {
      field: 'wishlist_id',
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
      allowNull: false
    }
  },
  {
    tableName: 'wishlists',
    underscored: true,
    timestamps: true,

    indexes: [
      {
        unique: true,

        fields: [
          'customer_id',
          'vehicle_id'
        ]
      }
    ]
  }
);

export default Wishlist;