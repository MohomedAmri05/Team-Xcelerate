'use strict';

/*
| Demonstration customer and complaints.
| Safe to run more than once: it skips records that already exist and never
| changes existing data.
*/

const bcrypt = require('bcrypt');

const crypto = require('crypto');

const CUSTOMER_EMAIL = 'customer@highstreet.lk';

// Demo password comes from .env (SEED_CUSTOMER_PASSWORD); otherwise a random
// one is generated and printed once. No password is written in the code.
function customerPassword() {
  const value = process.env.SEED_CUSTOMER_PASSWORD;

  if (value && value.length >= 8) {
    return value;
  }

  const generated = `${crypto.randomBytes(12).toString('base64url')}!9a`;
  console.log(`[seed] ${CUSTOMER_EMAIL} password (set SEED_CUSTOMER_PASSWORD in .env to choose your own): ${generated}`);
  return generated;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [[existing]] = await queryInterface.sequelize.query(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      { replacements: [CUSTOMER_EMAIL] }
    );

    let customerId = existing?.user_id;

    if (!customerId) {
      await queryInterface.bulkInsert('users', [
        {
          name: 'Demo Customer',
          email: CUSTOMER_EMAIL,
          password_hash: await bcrypt.hash(customerPassword(), 12),
          role: 'Customer',
          is_active: true,
          phone: '0771234567',
          address: 'Kandy, Sri Lanka',
          created_at: now,
          updated_at: now
        }
      ]);

      const [[created]] = await queryInterface.sequelize.query(
        'SELECT user_id FROM users WHERE email = ? LIMIT 1',
        { replacements: [CUSTOMER_EMAIL] }
      );

      customerId = created.user_id;
    }

    const [[{ total }]] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS total FROM complaints WHERE customer_id = ?',
      { replacements: [customerId] }
    );

    if (Number(total) > 0) {
      return;
    }

    const [[vehicle]] = await queryInterface.sequelize.query(
      'SELECT vehicle_id FROM vehicles ORDER BY vehicle_id ASC LIMIT 1'
    );

    const samples = [
      {
        category: 'Vehicle Condition',
        subject: 'Air conditioning not cooling after viewing',
        description:
          'During the showroom viewing the air conditioning only blew warm air. Please confirm whether it will be repaired before sale.',
        priority: 'High',
        status: 'In Progress',
        vehicle_id: vehicle?.vehicle_id || null
      },
      {
        category: 'Website',
        subject: 'Finance calculator showed a different term',
        description:
          'The finance calculator reset my loan term to 48 months when I changed the down payment. I expected it to keep 60 months.',
        priority: 'Low',
        status: 'Resolved',
        vehicle_id: null
      }
    ];

    for (const sample of samples) {
      const placeholder = `PENDING-SEED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await queryInterface.bulkInsert('complaints', [
        {
          reference: placeholder,
          customer_id: customerId,
          category: sample.category,
          subject: sample.subject,
          description: sample.description,
          priority: sample.priority,
          status: sample.status,
          vehicle_id: sample.vehicle_id,
          resolution_summary:
            sample.status === 'Resolved'
              ? 'The calculator now keeps the selected term when the down payment changes.'
              : null,
          resolved_at: sample.status === 'Resolved' ? now : null,
          last_activity_at: now,
          created_at: now,
          updated_at: now
        }
      ]);

      const [[row]] = await queryInterface.sequelize.query(
        'SELECT complaint_id FROM complaints WHERE reference = ?',
        { replacements: [placeholder] }
      );

      const reference = `HS-CMP-${now.getFullYear()}-${String(row.complaint_id).padStart(5, '0')}`;

      await queryInterface.sequelize.query('UPDATE complaints SET reference = ? WHERE complaint_id = ?', {
        replacements: [reference, row.complaint_id]
      });

      await queryInterface.bulkInsert('complaint_status_history', [
        {
          complaint_id: row.complaint_id,
          from_status: null,
          to_status: 'Submitted',
          note: 'Complaint submitted by customer',
          created_at: now
        },
        {
          complaint_id: row.complaint_id,
          from_status: 'Submitted',
          to_status: sample.status,
          note: 'Demonstration data',
          created_at: now
        }
      ]);

      await queryInterface.bulkInsert('complaint_messages', [
        {
          complaint_id: row.complaint_id,
          author_role: 'System',
          body: 'Thank you. Our team is looking into this and will update you shortly.',
          is_internal: false,
          source: 'Web',
          created_at: now,
          updated_at: now
        }
      ]);
    }
  },

  async down(queryInterface) {
    const [[customer]] = await queryInterface.sequelize.query(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      { replacements: [CUSTOMER_EMAIL] }
    );

    if (!customer) {
      return;
    }

    await queryInterface.bulkDelete('complaints', { customer_id: customer.user_id });
  }
};
