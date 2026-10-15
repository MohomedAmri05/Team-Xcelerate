/*
|--------------------------------------------------------------------------
| VIVA-HEADER – M.R. Ahamed – Admin Dashboard & Authentication
| Report Generation + CRUD resource 4: Saved Reports (table `saved_reports`)
|--------------------------------------------------------------------------
|   READ    listTypes            GET /api/v1/reports/types
|   READ    runReport            GET /api/v1/reports/:type
|   READ    exportReport         GET /api/v1/reports/:type/export/:format
|   CREATE  createSavedReport    POST /api/v1/saved-reports
|   READ    listSavedReports     GET /api/v1/saved-reports
|   READ    runSavedReport       GET /api/v1/saved-reports/:id/run
|   UPDATE  updateSavedReport    PUT /api/v1/saved-reports/:id
|   DELETE  deleteSavedReport    DELETE /api/v1/saved-reports/:id
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import { SavedReport } from '../models/index.js';
import { ok } from '../middleware/core.js';
import { logActivity } from '../services/activity.service.js';
import { EXPORT_FORMATS } from '../services/export.service.js';
import {
  MAX_EXPORT_ROWS,
  canAccessReport,
  generateReport,
  listReportTypes,
  validateFilters
} from '../services/report.service.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

const context = (req) => ({
  user: req.user,
  permissions: req.permissions
});

function filtersFromQuery(query) {
  const filters = { ...query };
  delete filters.format;

  return filters;
}

// VIVA CRUD READ – report types this user may run (GET /api/v1/reports/types)
export async function listTypes(req, res) {
  return ok(res, 'Report types retrieved', listReportTypes(context(req)), {
    formats: Object.keys(EXPORT_FORMATS)
  });
}

// VIVA CRUD READ – generate a report (GET /api/v1/reports/:type)
export async function runReport(req, res) {
  const report = await generateReport(req.params.type, filtersFromQuery(req.query), context(req));

  return ok(res, 'Report generated', report);
}

// VIVA CRUD READ – CSV / Excel / PDF (GET /api/v1/reports/:type/export/:format)
export async function exportReport(req, res) {
  /*
   * VIVA – Ahamed – new permission "Export reports" (October 2026): Staff
   * can view reports with "View limited analytics", but downloading CSV,
   * Excel or PDF needs this permission. Admins always may export.
   */
  if (req.user.role === 'Staff' && !req.permissions?.canExportReports) {
    return res.status(403).json({
      success: false,
      message: 'Your Staff account does not have permission to export reports',
      errors: []
    });
  }

  const format = String(req.params.format || '').toLowerCase();
  const exporter = EXPORT_FORMATS[format];

  if (!exporter) {
    throw httpError(422, 'Choose CSV, XLSX or PDF');
  }

  const report = await generateReport(req.params.type, filtersFromQuery(req.query), context(req), {
    limit: MAX_EXPORT_ROWS
  });

  const buffer = exporter.writer(report);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const filename = `high-street-${report.type}-report-${stamp}.${exporter.extension}`;

  await logActivity(req, 'report.exported', 'Report', null, `${report.title} exported as ${format.toUpperCase()} (${report.rowCount} rows)`);

  res.setHeader('Content-Type', exporter.contentType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Report-Rows', String(report.rowCount));
  res.setHeader('X-Report-Truncated', String(report.truncated));
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Report-Rows, X-Report-Truncated');

  return res.end(buffer);
}

/*
|--------------------------------------------------------------------------
| Saved report definitions (CRUD)
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – Saved Reports READ (GET /api/v1/saved-reports)
export async function listSavedReports(req, res) {
  const reports = await SavedReport.findAll({
    where: { createdBy: req.user.userId },
    order: [['updatedAt', 'DESC']]
  });

  // Hide saved reports the user can no longer access (e.g. permission removed).
  const visible = reports.filter((report) => canAccessReport(report.reportType, context(req)));

  return ok(res, 'Saved reports retrieved', visible);
}

function validateSaved(req) {
  const { name, reportType, filters } = req.validated.body;

  if (!canAccessReport(reportType, context(req))) {
    throw httpError(403, 'You do not have permission to use this report type');
  }

  return {
    name,
    reportType,
    filters: validateFilters(reportType, filters || {})
  };
}

// VIVA CRUD CREATE – Saved Reports CREATE (POST /api/v1/saved-reports)
export async function createSavedReport(req, res) {
  const data = validateSaved(req);

  const report = await SavedReport.create({
    ...data,
    createdBy: req.user.userId
  });

  await logActivity(req, 'report.saved', 'Report', report.reportId, `Saved report "${report.name}" created`);

  return res.status(201).json({
    success: true,
    message: 'Report saved',
    data: report,
    meta: {}
  });
}

async function findOwned(req) {
  const report = await SavedReport.findOne({
    where: {
      reportId: req.params.id,
      createdBy: req.user.userId
    }
  });

  if (!report) {
    throw httpError(404, 'Saved report not found');
  }

  return report;
}

// VIVA CRUD UPDATE – Saved Reports UPDATE (PUT /api/v1/saved-reports/:id)
export async function updateSavedReport(req, res) {
  const report = await findOwned(req);
  const data = validateSaved(req);

  await report.update(data);
  await logActivity(req, 'report.updated', 'Report', report.reportId, `Saved report "${report.name}" updated`);

  return ok(res, 'Saved report updated', report);
}

// VIVA CRUD DELETE – Saved Reports DELETE (DELETE /api/v1/saved-reports/:id)
export async function deleteSavedReport(req, res) {
  const report = await findOwned(req);

  await report.destroy();
  await logActivity(req, 'report.deleted', 'Report', report.reportId, `Saved report "${report.name}" deleted`);

  return ok(res, 'Saved report deleted');
}

// VIVA CRUD READ – Saved Reports READ + run (GET /api/v1/saved-reports/:id/run)
export async function runSavedReport(req, res) {
  const saved = await findOwned(req);
  const report = await generateReport(saved.reportType, saved.filters, context(req));

  await saved.update({ lastRunAt: new Date() });

  return ok(res, 'Report generated', {
    ...report,
    savedReport: {
      reportId: saved.reportId,
      name: saved.name
    }
  });
}
