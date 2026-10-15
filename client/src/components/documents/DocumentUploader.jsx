/*
| VIVA-UI – S.N. Herathge – Customer Documents (CRUD 4)
|   CREATE → POST /documents (linked to a finance application, booking, complaint or vehicle)
| API paths are relative to /api/v1 (services/api.js).
*/

import { CircleCheck, CircleX, FileUp, Loader, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';

/*
| Uploads one or more files to POST /documents, one request per file so
| each file gets its own progress bar and result. The server re-validates
| the type (by content), size and permissions; the checks here only give
| faster feedback.
*/

export const ACCEPTED_TYPES = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX'
};

const ACCEPT_ATTRIBUTE = '.pdf,.jpg,.jpeg,.png,.webp,.docx';
const DEFAULT_MAX_MB = 8;

export default function DocumentUploader({
  complaintId,
  bookingId,
  vehicleId,
  financeApplicationId,
  category,
  categories = null,
  allowVisibility = false,
  maxMb = DEFAULT_MAX_MB,
  disabled = false,
  compact = false,
  onUploaded
}) {
  const input = useRef(null);
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(category || categories?.[0] || '');
  const [visibility, setVisibility] = useState('Owner');
  const [description, setDescription] = useState('');
  const busy = items.some((item) => item.state === 'uploading');

  const update = (id, changes) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const uploadOne = async (file, id) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const knownExtension = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx'].includes(extension);

    if (!ACCEPTED_TYPES[file.type] && !knownExtension) {
      update(id, { state: 'error', message: 'Unsupported file type' });
      return false;
    }

    if (file.size > maxMb * 1024 * 1024) {
      update(id, { state: 'error', message: `Larger than ${maxMb} MB` });
      return false;
    }

    if (file.size === 0) {
      update(id, { state: 'error', message: 'The file is empty' });
      return false;
    }

    const form = new FormData();
    form.append('file', file);

    if (complaintId) form.append('complaintId', complaintId);
    if (bookingId) form.append('bookingId', bookingId);
    if (vehicleId) form.append('vehicleId', vehicleId);
    if (financeApplicationId) form.append('financeApplicationId', financeApplicationId);
    if (selectedCategory) form.append('category', selectedCategory);
    if (description.trim()) form.append('description', description.trim());
    if (allowVisibility) form.append('visibility', visibility);

    try {
      const response = await api.post('/documents', form, {
        onUploadProgress: (event) => {
          if (event.total) {
            update(id, { progress: Math.round((event.loaded / event.total) * 100) });
          }
        }
      });

      update(id, { state: 'done', progress: 100, message: 'Uploaded' });
      onUploaded?.(response.data.data);

      return true;
    } catch (error) {
      update(id, { state: 'error', message: errorMessage(error, 'Upload failed') });
      return false;
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 10);

    if (!files.length) {
      return;
    }

    const queued = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      progress: 0,
      state: 'uploading',
      message: 'Uploading…'
    }));

    setItems((current) => [...queued, ...current].slice(0, 12));

    let succeeded = 0;

    for (let index = 0; index < files.length; index += 1) {
      // Sequential uploads keep progress readable and respect server limits.
      // eslint-disable-next-line no-await-in-loop
      if (await uploadOne(files[index], queued[index].id)) {
        succeeded += 1;
      }
    }

    if (succeeded === files.length) {
      toast.success(succeeded === 1 ? 'Document uploaded' : `${succeeded} documents uploaded`);
      setDescription('');
    } else if (succeeded > 0) {
      toast.error(`${files.length - succeeded} of ${files.length} files could not be uploaded`);
    } else {
      toast.error('The upload failed. Check the file type and size.');
    }

    if (input.current) {
      input.current.value = '';
    }
  };

  return (
    <div className={`doc-uploader ${compact ? 'doc-uploader--compact' : ''}`}>
      {(categories || allowVisibility || !compact) && (
        <div className="doc-uploader__options">
          {categories && (
            <label>
              Document type
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                {categories.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          )}

          {allowVisibility && (
            <label>
              Who can see it
              <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                <option value="Owner">Customer and staff</option>
                <option value="Staff">Staff only (internal)</option>
              </select>
            </label>
          )}

          {!compact && (
            <label className="doc-uploader__description">
              Description (optional)
              <input
                type="text"
                maxLength={500}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="e.g. Photo of the scratch on the rear bumper"
              />
            </label>
          )}
        </div>
      )}

      <div
        className={`doc-uploader__drop ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);

          if (!disabled && !busy) {
            handleFiles(event.dataTransfer.files);
          }
        }}
      >
        <FileUp aria-hidden="true" />
        <div>
          <strong>{compact ? 'Attach files' : 'Drag files here or choose files'}</strong>
          <small>
            PDF, JPG, PNG, WebP or DOCX · up to {maxMb} MB each
          </small>
        </div>
        <button
          type="button"
          className="button ghost"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          <Upload />
          {busy ? 'Uploading…' : 'Choose files'}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ACCEPT_ATTRIBUTE}
          aria-label="Choose documents to upload"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className="doc-uploader__queue" aria-live="polite">
          {items.map((item) => (
            <li key={item.id} className={`is-${item.state}`}>
              {item.state === 'uploading' && <Loader className="spin" aria-hidden="true" />}
              {item.state === 'done' && <CircleCheck aria-hidden="true" />}
              {item.state === 'error' && <CircleX aria-hidden="true" />}
              <span className="doc-uploader__name">{item.name}</span>
              <span className="doc-uploader__bar" aria-hidden="true">
                <span style={{ width: `${item.progress}%` }} />
              </span>
              <small>{item.state === 'uploading' ? `${item.progress}%` : item.message}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
