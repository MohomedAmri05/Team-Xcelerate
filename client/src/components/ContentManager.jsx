import {
  Edit3,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  mediaUrl
} from '../utils/mediaUrl';

const emptyContent = {
  sectionSlug: '',
  title: '',
  body: '',
  imageUrl: '',
  displayOrder: 0,
  isPublished: false
};

export default function ContentManager() {
  const [
    records,
    setRecords
  ] = useState([]);

  const [
    form,
    setForm
  ] = useState({
    ...emptyContent
  });

  const [
    editingId,
    setEditingId
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    saving,
    setSaving
  ] = useState(false);

  const loadContent = async () => {
    setLoading(true);

    try {
      const response =
        await api.get('/content');

      const responseData =
        response.data.data;

      setRecords(
        Array.isArray(responseData)
          ? responseData
          : responseData?.rows || []
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load company content'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  const updateField = (
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const resetForm = () => {
    setEditingId(null);

    setForm({
      ...emptyContent
    });
  };

  const editContent = (record) => {
    setEditingId(
      record.contentId
    );

    setForm({
      sectionSlug:
        record.sectionSlug || '',

      title:
        record.title || '',

      body:
        record.body || '',

      imageUrl:
        record.imageUrl || '',

      displayOrder:
        Number(
          record.displayOrder
        ) || 0,

      isPublished:
        Boolean(
          record.isPublished
        )
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const saveContent = async (
    event
  ) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      sectionSlug:
        form.sectionSlug.trim(),

      title:
        form.title.trim(),

      body:
        form.body.trim(),

      imageUrl:
        form.imageUrl.trim(),

      displayOrder:
        Number(
          form.displayOrder
        ) || 0,

      isPublished:
        Boolean(
          form.isPublished
        )
    };

    try {
      if (editingId) {
        await api.put(
          `/content/${editingId}`,
          payload
        );

        toast.success(
          'Content updated'
        );
      } else {
        await api.post(
          '/content',
          payload
        );

        toast.success(
          'Content created'
        );
      }

      resetForm();
      await loadContent();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not save content'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteContent = async (
    record
  ) => {
    const confirmed =
      window.confirm(
        `Delete the "${record.title}" content record?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/content/${record.contentId}`
      );

      toast.success(
        'Content deleted'
      );

      if (
        editingId ===
        record.contentId
      ) {
        resetForm();
      }

      await loadContent();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not delete content'
      );
    }
  };

  return (
    <section className="content-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            WEBSITE CONTENT
          </p>

          <h2>
            {editingId
              ? `Edit content #${editingId}`
              : 'Add company content'}
          </h2>

          <p>
            Manage the text and images displayed
            across the public website.
          </p>
        </div>

        <button
          className="button ghost"
          type="button"
          disabled={loading}
          onClick={loadContent}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <form
        className="content-editor"
        onSubmit={saveContent}
      >
        <label>
          Section slug

          <input
            type="text"
            required
            maxLength="100"
            placeholder="Example: about"
            value={form.sectionSlug}
            onChange={(event) => {
              updateField(
                'sectionSlug',
                event.target.value
              );
            }}
          />

          <small>
            Use lowercase words separated by
            hyphens, such as about-us.
          </small>
        </label>

        <label>
          Title

          <input
            type="text"
            required
            maxLength="255"
            placeholder="Section title"
            value={form.title}
            onChange={(event) => {
              updateField(
                'title',
                event.target.value
              );
            }}
          />
        </label>

        <label className="content-body-field">
          Body

          <textarea
            required
            maxLength="10000"
            rows="8"
            placeholder="Enter the section content"
            value={form.body}
            onChange={(event) => {
              updateField(
                'body',
                event.target.value
              );
            }}
          />
        </label>

        <label>
          Image URL

          <input
            type="text"
            maxLength="500"
            placeholder="/uploads/image.webp or https://..."
            value={form.imageUrl}
            onChange={(event) => {
              updateField(
                'imageUrl',
                event.target.value
              );
            }}
          />
        </label>

        <label>
          Display order

          <input
            type="number"
            min="0"
            value={form.displayOrder}
            onChange={(event) => {
              updateField(
                'displayOrder',
                Number(
                  event.target.value
                )
              );
            }}
          />
        </label>

        <label className="content-published-field">
          <input
            type="checkbox"
            checked={
              form.isPublished
            }
            onChange={(event) => {
              updateField(
                'isPublished',
                event.target.checked
              );
            }}
          />

          Publish this content
        </label>

        {form.imageUrl && (
          <div className="content-image-preview">
            <span>Image preview</span>

            <img
              src={
                mediaUrl(
                  form.imageUrl
                )
              }
              alt={
                form.title ||
                'Content preview'
              }
            />
          </div>
        )}

        <div className="actions content-editor-actions">
          <button
            className="button"
            type="submit"
            disabled={saving}
          >
            {editingId
              ? <Edit3 size={17} />
              : <Plus size={17} />}

            {saving
              ? 'Saving…'
              : editingId
                ? 'Update content'
                : 'Create content'}
          </button>

          {editingId && (
            <button
              className="button ghost"
              type="button"
              onClick={resetForm}
            >
              <X size={17} />
              Cancel editing
            </button>
          )}
        </div>
      </form>

      <div className="content-manager-toolbar">
        <div>
          <p className="eyebrow">
            CONTENT RECORDS
          </p>

          <h2>
            Company content
          </h2>
        </div>

        <strong>
          {records.length}{' '}
          {records.length === 1
            ? 'record'
            : 'records'}
        </strong>
      </div>

      {loading && (
        <div className="state">
          Loading content…
        </div>
      )}

      {!loading &&
        records.length === 0 && (
          <div className="state">
            <FileText size={36} />

            <p>
              No company content has been
              created yet.
            </p>
          </div>
        )}

      <div className="managed-content-list">
        {records.map((record) => (
          <article
            className="managed-content-card"
            key={record.contentId}
          >
            {record.imageUrl && (
              <img
                src={
                  mediaUrl(
                    record.imageUrl
                  )
                }
                alt={
                  record.title ||
                  'Company content'
                }
              />
            )}

            <div className="managed-content-details">
              <div className="managed-content-heading">
                <div>
                  <p className="eyebrow">
                    {record.sectionSlug}
                  </p>

                  <h3>
                    {record.title}
                  </h3>
                </div>

                <span
                  className={
                    record.isPublished
                      ? 'content-status published'
                      : 'content-status draft'
                  }
                >
                  {record.isPublished
                    ? 'Published'
                    : 'Draft'}
                </span>
              </div>

              <p className="managed-content-body">
                {record.body}
              </p>

              <small>
                Display order:{' '}
                {record.displayOrder}
              </small>

              <div className="actions">
                <button
                  type="button"
                  onClick={() => {
                    editContent(
                      record
                    );
                  }}
                >
                  <Edit3 size={16} />
                  Edit
                </button>

                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    deleteContent(
                      record
                    );
                  }}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}