/*
| VIVA-UI – S.N. Herathge – Customer Documents (CRUD 4), customer side
|   CREATE upload → POST /documents
|   READ → GET /documents
|   UPDATE / DELETE → DocumentList.jsx
| API paths are relative to /api/v1 (services/api.js).
*/

import { FolderLock } from 'lucide-react';
import { useState } from 'react';

import DocumentList from '../components/documents/DocumentList';
import DocumentUploader from '../components/documents/DocumentUploader';
import SearchBar from '../components/ui/SearchBar';
import { Pagination } from '../components/ui/DataControls';
import { useApi } from '../hooks/useApi';

const CATEGORIES = ['Identity Document', 'Other'];

export default function MyDocuments() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/documents', {
    search: search || undefined,
    category: category || undefined,
    page,
    limit: 20
  });

  return (
    <section className="page section my-documents-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">CUSTOMER ACCOUNT</p>
          <h1>My documents.</h1>
          <p className="lead-small">
            Private files you have shared with High Street, such as your driving licence for a test drive or evidence for
            a complaint. Only you and authorised High Street staff can open them.
          </p>
        </div>
        <span className="secure-note">
          <FolderLock aria-hidden="true" />
          Stored privately · never public
        </span>
      </div>

      <section className="panel">
        <h2 className="panel-title">Upload a document</h2>
        <DocumentUploader categories={CATEGORIES} onUploaded={reload} />
      </section>

      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search file names"
          historyScope="my-documents"
        />
        <select
          aria-label="Document type"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All document types</option>
          <option>Identity Document</option>
          <option>Complaint Evidence</option>
          <option>Booking Document</option>
          <option>Other</option>
        </select>
      </div>

      {loading && <div className="state">Loading documents…</div>}
      {error && <div className="state">{error}</div>}
      {!loading && !error && (
        <section className="panel">
          <DocumentList
            documents={data || []}
            onChanged={reload}
            showLink
            emptyText={search || category ? 'No documents match your filters.' : 'You have not uploaded any documents yet.'}
          />
          <Pagination page={page} pages={meta?.pages} total={meta?.total} onChange={setPage} label="documents" />
        </section>
      )}
    </section>
  );
}
