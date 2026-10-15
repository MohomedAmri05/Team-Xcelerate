/*
| VIVA-UI – S.N. Herathge – Customer Documents (CRUD 4)
|   READ preview / download → GET /documents/:id/download
|   UPDATE rename → PATCH /documents/:id (the API also accepts category / description)
|   DELETE → DELETE /documents/:id
| API paths are relative to /api/v1 (services/api.js).
*/

import { Download, Eye, File, FileImage, FileText, Lock, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api, downloadFile, errorMessage, previewFile } from '../../services/api';
import { useAuth } from '../../features/auth/AuthContext';
import { useConfirm } from '../ui/ConfirmDialog';

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1048576).toFixed(2)} MB`;
};

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-LK', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : '';

function iconFor(extension) {
  if (['jpg', 'png', 'webp'].includes(extension)) {
    return FileImage;
  }

  if (extension === 'pdf' || extension === 'docx') {
    return FileText;
  }

  return File;
}

export default function DocumentList({ documents = [], onChanged, emptyText = 'No documents yet.', showLink = false }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState(null);

  const canModify = (document) =>
    user?.role === 'Admin' ||
    (document.uploadedBy === user?.userId && !(user?.role === 'Customer' && document.complaint?.status === 'Closed'));

  const download = async (document) => {
    setBusyId(document.documentId);

    try {
      await downloadFile(`/documents/${document.documentId}/download`, undefined, document.originalName);
    } catch (error) {
      toast.error(errorMessage(error, 'Download failed'));
    } finally {
      setBusyId(null);
    }
  };

  const preview = async (document) => {
    try {
      await previewFile(`/documents/${document.documentId}/download`);
    } catch (error) {
      toast.error(errorMessage(error, 'Preview failed'));
    }
  };

  const rename = async (document) => {
    const name = await confirm({
      title: 'Rename document',
      confirmLabel: 'Save name',
      input: {
        label: 'File name',
        defaultValue: document.originalName,
        minLength: 1,
        maxLength: 200
      }
    });

    if (!name || name === document.originalName) {
      return;
    }

    try {
      await api.patch(`/documents/${document.documentId}`, { originalName: name });
      toast.success('Document renamed');
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not rename the document'));
    }
  };

  const remove = async (document) => {
    const confirmed = await confirm({
      title: 'Delete document?',
      message: `"${document.originalName}" will be permanently removed.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setBusyId(document.documentId);

    try {
      await api.delete(`/documents/${document.documentId}`);
      toast.success('Document deleted');
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the document'));
    } finally {
      setBusyId(null);
    }
  };

  if (!documents.length) {
    return <p className="doc-list__empty">{emptyText}</p>;
  }

  return (
    <ul className="doc-list">
      {documents.map((document) => {
        const Icon = iconFor(document.extension);
        const previewable = ['pdf', 'jpg', 'png', 'webp'].includes(document.extension);

        return (
          <li key={document.documentId}>
            <Icon className="doc-list__icon" aria-hidden="true" />
            <div className="doc-list__meta">
              <strong title={document.originalName}>{document.originalName}</strong>
              <small>
                {document.category} · {String(document.extension).toUpperCase()} · {formatBytes(document.sizeBytes)} ·{' '}
                {formatDateTime(document.createdAt)}
                {document.uploader?.name && ` · ${document.uploader.name}`}
              </small>
              {document.description && <small className="doc-list__description">{document.description}</small>}
              {showLink && document.linkedTo && <small className="doc-list__link">{document.linkedTo.label}</small>}
            </div>
            {document.visibility === 'Staff' && (
              <span className="status-badge status-badge--warning status-badge--sm" title="Visible to staff only">
                <Lock />
                <span>Internal</span>
              </span>
            )}
            <div className="doc-list__actions">
              {previewable && (
                <button type="button" onClick={() => preview(document)} aria-label={`Preview ${document.originalName}`} title="Preview">
                  <Eye />
                </button>
              )}
              <button
                type="button"
                onClick={() => download(document)}
                disabled={busyId === document.documentId}
                aria-label={`Download ${document.originalName}`}
                title="Download"
              >
                <Download />
              </button>
              {canModify(document) && (
                <>
                  <button type="button" onClick={() => rename(document)} aria-label={`Rename ${document.originalName}`} title="Rename">
                    <Pencil />
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => remove(document)}
                    disabled={busyId === document.documentId}
                    aria-label={`Delete ${document.originalName}`}
                    title="Delete"
                  >
                    <Trash2 />
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
