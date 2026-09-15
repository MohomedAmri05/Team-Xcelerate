'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'wishlists',
      {
        wishlist_id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },

        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,

          references: {
            model: 'users',
            key: 'user_id'
          },

          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },

        vehicle_id: {
          type: Sequelize.INTEGER,
          allowNull: false,

          references: {
            model: 'vehicles',
            key: 'vehicle_id'
          },

          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
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

    /*
     * A Customer cannot save the same vehicle
     * more than once.
     */
    await queryInterface.addIndex(
      'wishlists',
      [
        'customer_id',
        'vehicle_id'
      ],
      {
        unique: true,
        name:
          'wishlists_customer_vehicle_unique'
      }
    );

    await queryInterface.addIndex(
      'wishlists',
      ['customer_id'],
      {
        name: 'wishlists_customer_index'
      }
    );

    await queryInterface.addIndex(
      'wishlists',
      ['vehicle_id'],
      {
        name: 'wishlists_vehicle_index'
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      'wishlists'
    );
  }
};