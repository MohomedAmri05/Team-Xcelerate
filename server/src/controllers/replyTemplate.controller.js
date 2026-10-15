/*
|--------------------------------------------------------------------------
| VIVA – H.F. Naaziq – Customer Enquiry module
| CRUD resource 4: Reply Templates (table `reply_templates`)
|--------------------------------------------------------------------------
|   CREATE  createTemplate   POST   /api/v1/reply-templates
|   READ    listTemplates    GET    /api/v1/reply-templates
|           getTemplate      GET    /api/v1/reply-templates/:id
|   UPDATE  updateTemplate   PUT    /api/v1/reply-templates/:id
|   DELETE  deleteTemplate   DELETE /api/v1/reply-templates/:id
|
| Who can use it: Admins, and Staff who have the "Manage enquiries" or
| "Manage complaints" permission. Staff may edit or delete only the
| templates they created; Admins may change any template.
|
| Templates are inserted into enquiry responses and complaint replies in
| the dashboard. Placeholders like {{customer_name}} are filled in there.
*/

import { Op } from 'sequelize';

import { ReplyTemplate, User } from '../models/index.js';
import { ok } from '../middleware/core.js';
import { logActivity } from '../services/activity.service.js';
import { REPLY_TEMPLATE_CATEGORIES } from '../models/extended.js';

export const TEMPLATE_PLACEHOLDERS = ['{{customer_name}}', '{{reference}}', '{{vehicle}}', '{{staff_name}}'];

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Admin, or Staff with an enquiry/complaint permission.
function canUseTemplates(req) {
  if (req.user.role === 'Admin') {
    return true;
  }

  return req.user.role === 'Staff' && Boolean(req.permissions?.canManageEnquiries || req.permissions?.canManageComplaints);
}

function canChange(req, template) {
  return req.user.role === 'Admin' || template.createdBy === req.user.userId;
}

function ensureAccess(req) {
  if (!canUseTemplates(req)) {
    throw httpError(403, 'You need the enquiry or complaint permission to use reply templates');
  }
}

const includes = [
  { model: User, as: 'creator', attributes: ['userId', 'name'], required: false },
  { model: User, as: 'editor', attributes: ['userId', 'name'], required: false }
];

async function findTemplate(id) {
  const template = await ReplyTemplate.findByPk(id, { include: includes });

  if (!template) {
    throw httpError(404, 'Reply template not found');
  }

  return template;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

/*
| READ – list templates (filters: category, active, search)
*/
export async function listTemplates(req, res) {
  ensureAccess(req);

  const where = {};

  if (REPLY_TEMPLATE_CATEGORIES.includes(req.query.category)) {
    // "Enquiry" also shows "General" templates, because they suit both.
    where.category = req.query.includeGeneral === 'true'
      ? { [Op.in]: [req.query.category, 'General'] }
      : req.query.category;
  }

  if (req.query.active === 'true' || req.query.active === 'false') {
    where.isActive = req.query.active === 'true';
  }

  if (req.query.search) {
    const term = `%${escapeLike(String(req.query.search).trim().slice(0, 100))}%`;
    where[Op.or] = [{ title: { [Op.like]: term } }, { body: { [Op.like]: term } }, { subject: { [Op.like]: term } }];
  }

  const templates = await ReplyTemplate.findAll({
    where,
    include: includes,
    order: [
      ['isActive', 'DESC'],
      ['category', 'ASC'],
      ['title', 'ASC']
    ]
  });

  return ok(res, 'Reply templates retrieved', templates, { placeholders: TEMPLATE_PLACEHOLDERS });
}

/*
| READ – one template
*/
export async function getTemplate(req, res) {
  ensureAccess(req);
  return ok(res, 'Reply template retrieved', await findTemplate(req.params.id));
}

/*
| CREATE – new template (title must be unique → 409 otherwise)
*/
export async function createTemplate(req, res) {
  ensureAccess(req);

  const body = req.validated.body;
  const template = await ReplyTemplate.create({
    ...body,
    createdBy: req.user.userId,
    updatedBy: req.user.userId
  });

  await logActivity(req, 'reply_template.created', 'ReplyTemplate', template.templateId, `Reply template "${template.title}" created`);

  return res.status(201).json({
    success: true,
    message: 'Reply template created',
    data: await findTemplate(template.templateId),
    meta: {}
  });
}

/*
| UPDATE – edit title, category, subject, text or active flag
*/
export async function updateTemplate(req, res) {
  ensureAccess(req);

  const template = await findTemplate(req.params.id);

  if (!canChange(req, template)) {
    throw httpError(403, 'Only the Staff member who created this template, or an Admin, can change it');
  }

  await template.update({ ...req.validated.body, updatedBy: req.user.userId });
  await logActivity(req, 'reply_template.updated', 'ReplyTemplate', template.templateId, `Reply template "${template.title}" updated`);

  return ok(res, 'Reply template updated', await findTemplate(template.templateId));
}

/*
| DELETE – permanently remove the template
| (responses already sent are not affected: they store their own text)
*/
export async function deleteTemplate(req, res) {
  ensureAccess(req);

  const template = await findTemplate(req.params.id);

  if (!canChange(req, template)) {
    throw httpError(403, 'Only the Staff member who created this template, or an Admin, can delete it');
  }

  const { title, templateId } = template;
  await template.destroy();
  await logActivity(req, 'reply_template.deleted', 'ReplyTemplate', templateId, `Reply template "${title}" deleted`);

  return ok(res, 'Reply template deleted');
}
