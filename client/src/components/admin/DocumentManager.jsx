/*
| VIVA-UI – S.N. Herathge – Customer Documents (CRUD 4), dashboard
|   CREATE vehicle documents → POST /documents
|   READ list, filters, preview, download → GET /documents, /documents/:id/download
|   DELETE → DELETE /documents/:id
| API paths are relative to /api/v1 (services/api.js).
*/

import { Download, Eye, FileText, Lock, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, downloadFile, errorMessage, previewFile } from '../../services/api';
import { useAuth } from '../../features/auth/AuthContext';
import DocumentList, { formatBytes, formatDateTime } from '../documents/DocumentList';
import DocumentUploader from '../documents/DocumentUploader';
import { useConfirm } from '../ui/ConfirmDialog';
import { EmptyState, Pagination, SortHeader, ViewToggle } from '../ui/DataControls';
import SearchBar from '../ui/SearchBar';

const CATEGORIES = ['Complaint Evidence', 'Booking Document', 'Vehicle Document', 'Identity Document', 'Finance Document', 'Other'];

export default function DocumentManager() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'Admin';
  const canInventory = isAdmin || user?.permissions?.canManageInventory;
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    linkedType: '',
    fileType: '',
    dateFrom: '',
    dateTo: ''
  });
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [view, setView] = useState('table');
  const [documents, setDocuments] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [uploadVehicleId, setUploadVehicleId] = useState('');
  const [columns, setColumns] = useState({ linked: true, uploader: true, size: true, date: true });

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  const sortParam = {
    'createdAt:desc': 'newest',
    'createdAt:asc': 'oldest',
    'originalName:asc': 'name',
    'originalName:desc': 'name_desc',
    'sizeBytes:desc': 'size',
    'sizeBytes:asc': 'size_asc'
  }[sort] || 'newest';

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = Object.fromEntries(
        Object.entries({ ...filters, sort: sortParam, page, limit: 20 }).filter(([, value]) => value !== '')
      );
      const response = await api.get('/documents', { params });
      setDocuments(response.data.data || []);
      setMeta(response.data.meta || {});
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load documents'));
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortParam]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canInventory) {
      return;
    }

    api
      .get('/vehicles', { params: { limit: 50 } })
      .then((response) => setVehicles(response.data.data || []))
      .catch(() => setVehicles([]));
  }, [canInventory]);

  const remove = async (document) => {
    const confirmed = await confirm({
      title: 'Delete document?',
      message: `"${document.originalName}" will be permanently removed from storage.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/documents/${document.documentId}`);
      toast.success('Document deleted');
      load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the document'));
    }
  };

  const activeFilters = Object.entries(filters).filter(([key, value]) => key !== 'search' && value).length;
  const canModify = (document) => isAdmin || document.uploadedBy === user?.userId;

  return (
    <section className="document-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">PRIVATE FILES</p>
          <h2>Documents</h2>
          <p>
            Files are stored outside the public website and can only be opened by signed-in users with access to the
            linked record.
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {canInventory && (
        <section className="panel document-manager__upload">
          <h3 className="panel-title">Upload a vehicle document</h3>
          <label>
            Vehicle
            <select value={uploadVehicleId} onChange={(event) => setUploadVehicleId(event.target.value)}>
              <option value="">Select a vehicle…</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                  #{vehicle.vehicleId} · {vehicle.year} {vehicle.make} {vehicle.model}
                </option>
              ))}
            </select>
          </label>
          {uploadVehicleId ? (
            <DocumentUploader
              key={uploadVehicleId}
              vehicleId={uploadVehicleId}
              category="Vehicle Document"
              allowVisibility
              onUploaded={load}
            />
          ) : (
            <p className="muted">
              Choose a vehicle to attach inspection reports, registration copies or other files. Complaint and booking
              documents are uploaded from those records.
            </p>
          )}
        </section>
      )}

      <div className="manager-toolbar manager-toolbar--wrap">
        <SearchBar
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
          placeholder="File name, description or document ID"
          historyScope="admin-documents"
        />
        <select aria-label="Category" value={filters.category} onChange={(event) => setFilter('category', event.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select aria-label="Linked record" value={filters.linkedType} onChange={(event) => setFilter('linkedType', event.target.value)}>
          <option value="">Any linked record</option>
          <option value="Complaint">Complaints</option>
          <option value="Booking">Test drives</option>
          <option value="Vehicle">Vehicles</option>
          <option value="Finance">Finance applications</option>
          {isAdmin && <option value="None">Not linked (customer vault)</option>}
        </select>
        <select aria-label="File type" value={filters.fileType} onChange={(event) => setFilter('fileType', event.target.value)}>
          <option value="">All file types</option>
          <option value="pdf">PDF</option>
          <option value="jpg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
          <option value="docx">Word (DOCX)</option>
        </select>
        <label className="inline-date">
          From
          <input type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} />
        </label>
        <label className="inline-date">
          To
          <input type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} />
        </label>
        {activeFilters > 0 && (
          <button
            type="button"
            className="clear"
            onClick={() => {
              setFilters((current) => ({ search: current.search, category: '', linkedType: '', fileType: '', dateFrom: '', dateTo: '' }));
              setPage(1);
            }}
          >
            <X size={15} />
            Clear filters
          </button>
        )}
      </div>

      {view === 'table' && (
        <div className="column-picker" role="group" aria-label="Visible columns">
          <span>Columns:</span>
          {[
            ['linked', 'Linked to'],
            ['uploader', 'Uploaded by'],
            ['size', 'Size'],
            ['date', 'Date']
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={columns[key]}
                onChange={(event) => setColumns({ ...columns, [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {loading && <div className="state">Loading documents…</div>}

      {!loading && !documents.length && (
        <EmptyState icon={FileText} title="No documents found">
          {filters.search || activeFilters ? 'Try a different search or clear the filters.' : 'Uploaded documents will appear here.'}
        </EmptyState>
      )}

      {!loading && documents.length > 0 && view === 'grid' && (
        <section className="panel">
          <DocumentList documents={documents} onChanged={load} showLink />
        </section>
      )}

      {!loading && documents.length > 0 && view === 'table' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <SortHeader label="File" field="originalName" sort={sort} onSort={setSort} />
                </th>
                <th>Category</th>
                {columns.linked && <th>Linked to</th>}
                {columns.uploader && <th>Uploaded by</th>}
                {columns.size && (
                  <th>
                    <SortHeader label="Size" field="sizeBytes" sort={sort} onSort={setSort} />
                  </th>
                )}
                {columns.date && (
                  <th>
                    <SortHeader label="Uploaded" field="createdAt" sort={sort} onSort={setSort} />
                  </th>
                )}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.documentId}>
                  <td className="cell-wrap">
                    <strong>{document.originalName}</strong>
                    <small>
                      #{document.documentId} · {String(document.extension).toUpperCase()}
                      {document.visibility === 'Staff' && (
                        <>
                          {' '}
                          · <Lock size={11} aria-hidden="true" /> staff only
                        </>
                      )}
                    </small>
                  </td>
                  <td>{document.category}</td>
                  {columns.linked && <td>{document.linkedTo?.label || <span className="muted">Customer vault</span>}</td>}
                  {columns.uploader && (
                    <td>
                      {document.uploader?.name || (document.uploadedBy ? `User #${document.uploadedBy}` : 'Deleted staff member')}
                      <small>{document.uploader?.role}</small>
                    </td>
                  )}
                  {columns.size && <td>{formatBytes(document.sizeBytes)}</td>}
                  {columns.date && <td>{formatDateTime(document.createdAt)}</td>}
                  <td className="row-actions">
                    {['pdf', 'jpg', 'png', 'webp'].includes(document.extension) && (
                      <button
                        type="button"
                        title="Preview"
                        aria-label={`Preview ${document.originalName}`}
                        onClick={() => previewFile(`/documents/${document.documentId}/download`).catch((error) => toast.error(errorMessage(error)))}
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Download"
                      aria-label={`Download ${document.originalName}`}
                      onClick={() =>
                        downloadFile(`/documents/${document.documentId}/download`, undefined, document.originalName).catch((error) =>
                          toast.error(errorMessage(error, 'Download failed'))
                        )
                      }
                    >
                      <Download size={16} />
                    </button>
                    {canModify(document) && (
                      <button type="button" className="danger" title="Delete" aria-label={`Delete ${document.originalName}`} onClick={() => remove(document)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={meta.page || page} pages={meta.pages} total={meta.total} onChange={setPage} label="documents" />
    </section>
  );
}
