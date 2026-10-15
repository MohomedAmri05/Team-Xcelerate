/*
| VIVA-UI – M.R. Ahamed – Report Generation + Saved Reports (CRUD 4)
|   READ generate a report → GET /reports/:type; export → GET /reports/:type/export/:format
|   CREATE "Save report" → POST /saved-reports
|   READ saved list → GET /saved-reports; "Run" re-generates it with the saved filters
|   UPDATE "Update saved report" → PUT /saved-reports/:id
|   DELETE → DELETE /saved-reports/:id
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  BarChart3,
  Bookmark,
  CalendarRange,
  FileDown,
  FileSpreadsheet,
  FileText,
  Pencil,
  Play,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { api, downloadFile, errorMessage } from '../../services/api';
import { useAuth } from '../../features/auth/AuthContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { BarBreakdown, EmptyState, Pagination, SortHeader, sortRows } from '../ui/DataControls';
import StatusBadge from '../ui/StatusBadge';

const STATUS_KIND = {
  vehicles: 'vehicle',
  'vehicle-demand': 'vehicle',
  enquiries: 'enquiry',
  bookings: 'booking',
  complaints: 'complaint',
  users: 'account',
  sessions: 'session',
  emails: 'email'
};

const PAGE_SIZE = 50;

const WRAP_COLUMNS = ['subject', 'summary', 'lastError', 'vehicle', 'vehicleReference', 'originalName', 'user', 'device', 'linked'];

const pad = (number) => String(number).padStart(2, '0');
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function presetRange(preset) {
  const today = new Date();
  const start = new Date(today);

  switch (preset) {
    case 'today':
      return { dateFrom: isoDate(today), dateTo: isoDate(today) };
    case '7d':
      start.setDate(today.getDate() - 6);
      return { dateFrom: isoDate(start), dateTo: isoDate(today) };
    case '30d':
      start.setDate(today.getDate() - 29);
      return { dateFrom: isoDate(start), dateTo: isoDate(today) };
    case 'month':
      return { dateFrom: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: isoDate(today) };
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { dateFrom: isoDate(first), dateTo: isoDate(last) };
    }
    case 'year':
      return { dateFrom: `${today.getFullYear()}-01-01`, dateTo: isoDate(today) };
    default:
      return { dateFrom: '', dateTo: '' };
  }
}

const filterLabel = (filter, option) => {
  if (filter.key === 'isActive') return option === 'true' ? 'Active' : 'Inactive';
  if (filter.key === 'dateField') return option === 'createdAt' ? 'Request date' : 'Appointment date';

  return option;
};

function formatCell(column, value) {
  if (value === null || value === undefined || value === '') {
    return <span className="muted">—</span>;
  }

  if (column.type === 'currency') {
    return `LKR ${Number(value).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
  }

  if (column.type === 'number' && Math.abs(Number(value)) >= 10000) {
    return Number(value).toLocaleString('en-LK');
  }

  return String(value);
}

export default function ReportCenter() {
  const confirm = useConfirm();
  // VIVA – Ahamed – "Export reports" permission (Admins always may export)
  const { user } = useAuth();
  const canExport = user?.role === 'Admin' || Boolean(user?.permissions?.canExportReports);
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('');
  const [filters, setFilters] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState({});
  const [saved, setSaved] = useState([]);
  const [editingSaved, setEditingSaved] = useState(null);
  const [error, setError] = useState(null);

  const definition = types.find((item) => item.key === type);

  const loadSaved = useCallback(async () => {
    try {
      const response = await api.get('/saved-reports');
      setSaved(response.data.data || []);
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => {
    api
      .get('/reports/types')
      .then((response) => {
        const list = response.data.data || [];
        setTypes(list);
        setType((current) => current || list[0]?.key || '');
      })
      .catch((requestError) => setError(errorMessage(requestError, 'Could not load report types')));

    loadSaved();
  }, [loadSaved]);

  const cleanFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined && value !== null)),
    [filters]
  );

  const dateError =
    cleanFilters.dateFrom && cleanFilters.dateTo && cleanFilters.dateFrom > cleanFilters.dateTo
      ? 'The start date must be on or before the end date'
      : null;

  const generate = useCallback(
    async (reportType = type, reportFilters = cleanFilters) => {
      if (!reportType) {
        return;
      }

      if (reportFilters.dateFrom && reportFilters.dateTo && reportFilters.dateFrom > reportFilters.dateTo) {
        toast.error('The start date must be on or before the end date');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await api.get(`/reports/${reportType}`, { params: reportFilters });
        setReport(response.data.data);
        setPage(1);
        setTableSearch('');
        setSort('');
        setHidden({});
      } catch (requestError) {
        setReport(null);
        setError(errorMessage(requestError, 'The report could not be generated'));
        toast.error(errorMessage(requestError, 'The report could not be generated'));
      } finally {
        setLoading(false);
      }
    },
    [type, cleanFilters]
  );

  const chooseType = (key) => {
    setType(key);
    setFilters({});
    setReport(null);
    setEditingSaved(null);
  };

  const exportAs = async (format) => {
    if (!report) {
      return;
    }

    setExporting(format);

    try {
      const result = await downloadFile(`/reports/${report.type}/export/${format}`, report.filters, `${report.type}.${format}`);
      toast.success(`${format.toUpperCase()} downloaded${result.rows !== null ? ` (${result.rows} rows)` : ''}`);

      if (result.truncated) {
        toast('The export was limited to the first 20,000 rows. Narrow the filters for a complete file.', { icon: '⚠️' });
      }
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Export failed'));
    } finally {
      setExporting('');
    }
  };

  const saveReport = async (asNew) => {
    let name = editingSaved && !asNew ? editingSaved.name : null;

    if (!name) {
      name = await confirm({
        title: 'Save this report',
        message: 'Saved reports keep the report type and filters so you can run them again in one click.',
        confirmLabel: 'Save report',
        input: {
          label: 'Report name',
          minLength: 2,
          maxLength: 120,
          defaultValue: definition ? `${definition.label}${cleanFilters.dateFrom ? ` ${cleanFilters.dateFrom}` : ''}` : ''
        }
      });
    }

    if (!name) {
      return;
    }

    try {
      if (editingSaved && !asNew) {
        await api.put(`/saved-reports/${editingSaved.reportId}`, { name, reportType: type, filters: cleanFilters });
        toast.success('Saved report updated');
      } else {
        const response = await api.post('/saved-reports', { name, reportType: type, filters: cleanFilters });
        setEditingSaved(response.data.data);
        toast.success('Report saved');
      }

      loadSaved();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Could not save the report'));
    }
  };

  const runSaved = async (entry) => {
    setType(entry.reportType);
    setFilters(entry.filters || {});
    setEditingSaved(entry);
    await generate(entry.reportType, entry.filters || {});
    loadSaved();
  };

  const editSaved = (entry) => {
    setType(entry.reportType);
    setFilters(entry.filters || {});
    setEditingSaved(entry);
    setReport(null);
    toast('Saved report loaded. Change the filters, then choose "Update saved report".', { icon: '✏️' });
  };

  const deleteSaved = async (entry) => {
    const confirmed = await confirm({
      title: `Delete "${entry.name}"?`,
      message: 'Only the saved filters are removed. No data is deleted.',
      confirmLabel: 'Delete',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/saved-reports/${entry.reportId}`);
      toast.success('Saved report deleted');

      if (editingSaved?.reportId === entry.reportId) {
        setEditingSaved(null);
      }

      loadSaved();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Could not delete the saved report'));
    }
  };

  const visibleColumns = report ? report.columns.filter((column) => !hidden[column.key]) : [];

  const filteredRows = useMemo(() => {
    if (!report) {
      return [];
    }

    const term = tableSearch.trim().toLowerCase();
    const rows = term
      ? report.rows.filter((row) => report.columns.some((column) => String(row[column.key] ?? '').toLowerCase().includes(term)))
      : report.rows;

    return sortRows(rows, sort);
  }, [report, tableSearch, sort]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusKind = STATUS_KIND[report?.type];

  if (error && !types.length) {
    return <div className="state">{error}</div>;
  }

  return (
    <section className="report-center">
      <div className="admin-head no-print">
        <div>
          <p className="eyebrow">REPORT GENERATION</p>
          <h2>Reports</h2>
          <p>Generate reports from live data, then print them or export them as CSV, Excel or PDF.</p>
        </div>
      </div>

      <div className="report-types no-print" role="tablist" aria-label="Report type">
        {types.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={item.key === type}
            key={item.key}
            className={item.key === type ? 'active' : ''}
            onClick={() => chooseType(item.key)}
          >
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>

      {definition && (
        <form
          className="report-filters panel no-print"
          onSubmit={(event) => {
            event.preventDefault();
            generate();
          }}
        >
          <div className="report-filters__head">
            <h3>
              <CalendarRange aria-hidden="true" />
              {definition.label} filters
              {editingSaved && <span className="tag">Editing “{editingSaved.name}”</span>}
            </h3>
            <div className="report-presets" role="group" aria-label="Date presets">
              {[
                ['', 'All time'],
                ['today', 'Today'],
                ['7d', '7 days'],
                ['30d', '30 days'],
                ['month', 'This month'],
                ['lastMonth', 'Last month'],
                ['year', 'This year']
              ].map(([key, label]) => (
                <button type="button" key={key || 'all'} onClick={() => setFilters((current) => ({ ...current, ...presetRange(key) }))}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="report-filters__grid">
            {definition.filters.map((filter) => (
              <label key={filter.key}>
                {filter.label}
                {filter.type === 'select' ? (
                  <select
                    value={filters[filter.key] || ''}
                    onChange={(event) => setFilters({ ...filters, [filter.key]: event.target.value })}
                  >
                    <option value="">{filter.key === 'dateField' ? 'Appointment date' : 'Any'}</option>
                    {filter.options
                      .filter((option) => !(filter.key === 'dateField' && option === 'preferredDate'))
                      .map((option) => (
                        <option key={option} value={option}>
                          {filterLabel(filter, option)}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type={filter.type === 'date' ? 'date' : 'text'}
                    maxLength={100}
                    value={filters[filter.key] || ''}
                    aria-invalid={Boolean(dateError && filter.type === 'date')}
                    onChange={(event) => setFilters({ ...filters, [filter.key]: event.target.value })}
                    placeholder={filter.type === 'text' ? 'Name, reference…' : undefined}
                  />
                )}
              </label>
            ))}
          </div>

          {dateError && <p className="field-error">{dateError}</p>}

          <div className="actions">
            <button className="button" type="submit" disabled={loading || Boolean(dateError)}>
              {loading ? <RefreshCw className="spin" /> : <BarChart3 />}
              {loading ? 'Generating…' : 'Generate report'}
            </button>
            <button type="button" className="button ghost" onClick={() => setFilters({})}>
              Reset filters
            </button>
            <button type="button" className="button ghost" onClick={() => saveReport(false)} disabled={Boolean(dateError)}>
              <Save />
              {editingSaved ? 'Update saved report' : 'Save report'}
            </button>
            {editingSaved && (
              <button type="button" className="button ghost" onClick={() => saveReport(true)}>
                <Bookmark />
                Save as new
              </button>
            )}
          </div>
        </form>
      )}

      {saved.length > 0 && (
        <section className="saved-reports panel no-print">
          <h3 className="panel-title">
            <Bookmark aria-hidden="true" />
            Saved reports
          </h3>
          <ul>
            {saved.map((entry) => (
              <li key={entry.reportId} className={editingSaved?.reportId === entry.reportId ? 'active' : ''}>
                <div>
                  <strong>{entry.name}</strong>
                  <small>
                    {types.find((item) => item.key === entry.reportType)?.label || entry.reportType}
                    {entry.lastRunAt ? ` · last run ${new Date(entry.lastRunAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}` : ' · never run'}
                  </small>
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => runSaved(entry)} title="Run" aria-label={`Run ${entry.name}`}>
                    <Play size={16} />
                  </button>
                  <button type="button" onClick={() => editSaved(entry)} title="Edit filters" aria-label={`Edit ${entry.name}`}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="danger" onClick={() => deleteSaved(entry)} title="Delete" aria-label={`Delete ${entry.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && types.length > 0 && <div className="state no-print">{error}</div>}

      {report && (
        <article className="report-output" aria-live="polite">
          <header className="report-output__header">
            <div>
              <p className="eyebrow">HIGH STREET (PVT) LTD.</p>
              <h2>{report.title}</h2>
              <p className="muted">
                Generated {report.generatedAt} by {report.generatedBy}
                {report.filtersText ? ` · ${report.filtersText}` : ' · No filters (all records)'}
              </p>
            </div>
            <div className="report-output__exports no-print">
              {canExport ? (
                <>
                  <button type="button" className="button ghost" onClick={() => exportAs('csv')} disabled={Boolean(exporting)}>
                    <FileDown />
                    {exporting === 'csv' ? 'Preparing…' : 'CSV'}
                  </button>
                  <button type="button" className="button ghost" onClick={() => exportAs('xlsx')} disabled={Boolean(exporting)}>
                    <FileSpreadsheet />
                    {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
                  </button>
                  <button type="button" className="button ghost" onClick={() => exportAs('pdf')} disabled={Boolean(exporting)}>
                    <FileText />
                    {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
                  </button>
                </>
              ) : (
                <span className="export-locked" title="Ask an Admin for the Export reports permission">
                  Export needs the “Export reports” permission
                </span>
              )}
              <button type="button" className="button" onClick={() => window.print()}>
                <Printer />
                Print
              </button>
            </div>
          </header>

          <div className="report-summary">
            {report.summary.map((item) => (
              <div key={item.label} className="report-summary__card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {report.groups?.some((group) => group.items.length) && (
            <div className="report-groups">
              {report.groups.map((group) => (
                <BarBreakdown key={group.label} title={group.label} items={group.items} />
              ))}
            </div>
          )}

          {report.notes && <p className="muted report-notes">{report.notes}</p>}

          {report.truncated && (
            <p className="report-warning">
              <TriangleAlert aria-hidden="true" />
              Showing the first {report.rowCount.toLocaleString()} of {report.total.toLocaleString()} records on screen. Totals
              above include every matching record. Exports include up to 20,000 rows.
            </p>
          )}

          {!report.rows.length ? (
            <EmptyState icon={BarChart3} title="No records match these filters">
              Try a wider date range or remove a filter, then generate the report again.
            </EmptyState>
          ) : (
            <>
              <div className="report-table-tools no-print">
                <label className="report-table-search">
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    value={tableSearch}
                    placeholder="Search within these results"
                    aria-label="Search within report results"
                    onChange={(event) => {
                      setTableSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <details className="column-menu">
                  <summary>Columns ({visibleColumns.length}/{report.columns.length})</summary>
                  <div>
                    {report.columns.map((column) => (
                      <label key={column.key}>
                        <input
                          type="checkbox"
                          checked={!hidden[column.key]}
                          disabled={!hidden[column.key] && visibleColumns.length === 1}
                          onChange={(event) => setHidden({ ...hidden, [column.key]: !event.target.checked })}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </details>
                <span className="data-count">
                  {filteredRows.length.toLocaleString()} {filteredRows.length === 1 ? 'row' : 'rows'}
                  {tableSearch ? ` matching “${tableSearch}”` : ''}
                </span>
              </div>

              <div className="table-wrap report-table-wrap">
                <table className="data-table report-table">
                  <thead>
                    <tr>
                      {visibleColumns.map((column) => (
                        <th key={column.key} className={column.type === 'number' || column.type === 'currency' ? 'num' : ''}>
                          <SortHeader label={column.label} field={column.key} sort={sort} onSort={setSort} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Screen: current page. Print: every filtered row (see print CSS). */}
                    {filteredRows.map((row, index) => (
                      <tr
                        key={`${index}-${row[report.columns[0].key]}`}
                        className={index >= (page - 1) * PAGE_SIZE && index < page * PAGE_SIZE ? '' : 'print-only-row'}
                      >
                        {visibleColumns.map((column) => (
                          <td key={column.key} className={
                              column.type === 'number' || column.type === 'currency'
                                ? 'num'
                                : WRAP_COLUMNS.includes(column.key)
                                  ? 'cell-wrap'
                                  : 'nowrap'
                            }>
                            {column.type === 'status' && row[column.key] ? (
                              <StatusBadge
                                kind={column.key === 'priority' ? 'priority' : statusKind}
                                status={row[column.key]}
                                size="sm"
                              />
                            ) : (
                              formatCell(column, row[column.key])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pageRows.length === 0 && <p className="muted">No rows match “{tableSearch}”.</p>}

              <div className="no-print">
                <Pagination page={page} pages={pages} total={filteredRows.length} onChange={setPage} label="rows" />
              </div>
            </>
          )}
        </article>
      )}

      {!report && !loading && definition && (
        <EmptyState icon={BarChart3} title="Choose filters and generate a report">
          {definition.description}
        </EmptyState>
      )}
    </section>
  );
}
