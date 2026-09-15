'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('Admin', 'Staff', 'Customer'),
      allowNull: false,
      defaultValue: 'Customer'
    });

    await queryInterface.addColumn('users', 'phone', {
      type: Sequelize.STRING(30),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'address', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'profile_image_url', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'email_verified_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'last_login_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'last_login_at');
    await queryInterface.removeColumn('users', 'email_verified_at');
    await queryInterface.removeColumn('users', 'profile_image_url');
    await queryInterface.removeColumn('users', 'address');
    await queryInterface.removeColumn('users', 'phone');

    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('Admin', 'Staff'),
      allowNull: false,
      defaultValue: 'Staff'
    });
  }
};