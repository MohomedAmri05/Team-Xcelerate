'use strict';

/*
| VIVA – Naaziq – Reply Templates: starter templates for demonstrations.
| Idempotent: a template is only added when no template has that title.
| Contains no phone numbers or addresses (those come from Company Content).
*/

const TEMPLATES = [
  {
    title: 'Vehicle still available',
    category: 'Enquiry',
    subject: 'About the {{vehicle}}',
    body: 'Hello {{customer_name}},\n\nThank you for your enquiry about the {{vehicle}}. It is still available. Please reply with a day and time that suits you, and we will arrange a viewing or a test drive.\n\nKind regards,\n{{staff_name}}\nHigh Street'
  },
  {
    title: 'Viewing appointment confirmed',
    category: 'Enquiry',
    subject: 'Your viewing of the {{vehicle}}',
    body: 'Hello {{customer_name}},\n\nYour viewing of the {{vehicle}} is confirmed. Please bring your driving licence if you would like to take a test drive.\n\nKind regards,\n{{staff_name}}\nHigh Street'
  },
  {
    title: 'Complaint received – reviewing',
    category: 'Complaint',
    subject: 'Your complaint {{reference}}',
    body: 'Hello {{customer_name}},\n\nThank you for telling us about this. We are reviewing complaint {{reference}} and will update you as soon as we have checked the details.\n\nKind regards,\n{{staff_name}}\nHigh Street'
  },
  {
    title: 'Complaint resolved – please confirm',
    category: 'Complaint',
    subject: 'Complaint {{reference}} resolved',
    body: 'Hello {{customer_name}},\n\nWe believe complaint {{reference}} is now resolved. Please confirm in your High Street account, or reply if anything is still not right.\n\nKind regards,\n{{staff_name}}\nHigh Street'
  },
  {
    title: 'Thank you',
    category: 'General',
    subject: null,
    body: 'Hello {{customer_name}},\n\nThank you for contacting High Street. Please let us know if there is anything else we can help with.\n\nKind regards,\n{{staff_name}}'
  }
];

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query('SELECT title FROM reply_templates');
    const titles = new Set(existing.map((row) => row.title));
    const now = new Date();
    const rows = TEMPLATES.filter((template) => !titles.has(template.title)).map((template) => ({
      ...template,
      is_active: true,
      created_at: now,
      updated_at: now
    }));

    if (rows.length) {
      await queryInterface.bulkInsert('reply_templates', rows);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('reply_templates', { title: { [Sequelize.Op.in]: TEMPLATES.map((template) => template.title) } });
  }
};
