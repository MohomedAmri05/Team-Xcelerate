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
    },

    /*
     * VIVA – Amri – Wishlists: UPDATE.
     * Private note the customer can edit on a saved vehicle.
     */
    note: {
      type: DataTypes.STRING(255),
      allowNull: true
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