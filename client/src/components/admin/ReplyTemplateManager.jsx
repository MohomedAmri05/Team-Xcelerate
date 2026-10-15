import { Copy, FilePlus2, MessageSquareText, Pencil, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import { useAuth } from '../../features/auth/AuthContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { EmptyState, FilterChips } from '../ui/DataControls';
import SearchBar from '../ui/SearchBar';
import StatusBadge from '../ui/StatusBadge';
import { formatDateTime } from '../documents/DocumentList';

/*
|--------------------------------------------------------------------------
| VIVA – H.F. Naaziq – Reply Templates (CRUD resource 4)
|--------------------------------------------------------------------------
| Dashboard › Customers › Reply templates
|   CREATE  form "Create template"    → POST   /api/v1/reply-templates
|   READ    list / filters / search   → GET    /api/v1/reply-templates
|   UPDATE  "Edit" then "Save"        → PUT    /api/v1/reply-templates/:id
|   DELETE  "Delete"                  → DELETE /api/v1/reply-templates/:id
| Templates are then inserted from the "Insert template" picker in the
| Enquiries and Complaints reply boxes (see TemplatePicker.jsx).
*/

const CATEGORIES = ['Enquiry', 'Complaint', 'General'];
const PLACEHOLDERS = ['{{customer_name}}', '{{reference}}', '{{vehicle}}', '{{staff_name}}'];
const EMPTY = { title: '', category: 'Enquiry', subject: '', body: '', isActive: true };

export default function ReplyTemplateManager() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);

    try {
      // Category is filtered in the browser so the chip counts stay correct.
      const params = {};
      if (search.trim()) params.search = search.trim();
      const response = await api.get('/reply-templates', { params });
      setTemplates(response.data.data || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load reply templates'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setErrors({});
  };

  const edit = (template) => {
    setEditingId(template.templateId);
    setForm({
      title: template.title,
      category: template.category,
      subject: template.subject || '',
      body: template.body,
      isActive: template.isActive
    });
    setErrors({});
    window.requestAnimationFrame(() => document.getElementById('template-title')?.focus());
  };

  const insertPlaceholder = (placeholder) => {
    const field = document.getElementById('template-body');
    const start = field?.selectionStart ?? form.body.length;
    const end = field?.selectionEnd ?? form.body.length;
    const body = `${form.body.slice(0, start)}${placeholder}${form.body.slice(end)}`;
    setForm({ ...form, body });
    window.requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = { ...form, subject: form.subject.trim() || null };

    try {
      if (editingId) {
        await api.put(`/reply-templates/${editingId}`, payload); // UPDATE
        toast.success('Template updated');
      } else {
        await api.post('/reply-templates', payload); // CREATE
        toast.success('Template created');
      }

      reset();
      load();
    } catch (error) {
      const fieldErrors = Object.fromEntries((error.response?.data?.errors || []).map((item) => [item.field, item.message]));
      setErrors(fieldErrors);
      toast.error(
        error.response?.status === 409 ? 'A template with this title already exists' : errorMessage(error, 'Could not save the template')
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (template) => {
    const confirmed = await confirm({
      title: 'Delete template?',
      message: `"${template.title}" will be permanently deleted. Replies already sent are not affected.`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/reply-templates/${template.templateId}`); // DELETE
      toast.success('Template deleted');

      if (editingId === template.templateId) {
        reset();
      }

      load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete the template'));
    }
  };

  const duplicate = (template) => {
    setEditingId(null);
    setForm({ title: `${template.title} (copy)`.slice(0, 120), category: template.category, subject: template.subject || '', body: template.body, isActive: true });
    window.requestAnimationFrame(() => document.getElementById('template-title')?.focus());
  };

  const canChange = (template) => user?.role === 'Admin' || template.createdBy === user?.userId;
  const counts = {
    __all: templates.length,
    ...Object.fromEntries(CATEGORIES.map((name) => [name, templates.filter((template) => template.category === name).length]))
  };
  const shown = category ? templates.filter((template) => template.category === category) : templates;

  return (
    <section className="template-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">CUSTOMER CARE</p>
          <h2>Reply templates</h2>
          <p>Save answers you send often, then insert them into enquiry responses and complaint replies.</p>
        </div>
      </div>

      <div className="template-layout">
        <form className="panel template-form" onSubmit={save} noValidate>
          <h3 className="panel-title">{editingId ? 'Edit template' : 'Create template'}</h3>

          <label>
            Title
            <input
              id="template-title"
              value={form.title}
              maxLength={120}
              required
              aria-invalid={Boolean(errors.title)}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="e.g. Viewing appointment confirmed"
            />
            {errors.title && <small className="field-error">{errors.title}</small>}
          </label>

          <label>
            Used for
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {CATEGORIES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="checkbox-inline">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            <span>Active — shown in the “Insert template” picker</span>
          </label>

          <label>
            <span>
              Email subject <span className="muted">(optional)</span>
            </span>
            <input
              value={form.subject}
              maxLength={180}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              placeholder="e.g. Your viewing for {{vehicle}}"
            />
          </label>

          <label>
            Text
            <textarea
              id="template-body"
              rows={8}
              value={form.body}
              maxLength={5000}
              required
              aria-invalid={Boolean(errors.body)}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder="Hello {{customer_name}}, thank you for your enquiry about the {{vehicle}}…"
            />
            {errors.body && <small className="field-error">{errors.body}</small>}
          </label>

          <div className="placeholder-chips" aria-label="Insert a placeholder">
            <span className="muted">Insert:</span>
            {PLACEHOLDERS.map((placeholder) => (
              <button type="button" key={placeholder} className="chip" onClick={() => insertPlaceholder(placeholder)}>
                {placeholder}
              </button>
            ))}
          </div>

          <div className="actions">
            <button type="submit" className="button" disabled={saving}>
              {editingId ? <Save size={16} /> : <FilePlus2 size={16} />}
              {saving ? 'Saving…' : editingId ? 'Save template' : 'Create template'}
            </button>
            {(editingId || form.title || form.body) && (
              <button type="button" className="button ghost" onClick={reset}>
                <X size={16} /> Cancel
              </button>
            )}
          </div>
        </form>

        <div className="template-list-wrap">
          <div className="manager-toolbar manager-toolbar--wrap">
            <SearchBar value={search} onChange={setSearch} placeholder="Search title or text" historyScope="admin-templates" />
          </div>
          <FilterChips
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            counts={counts}
          />

          {loading && <div className="state">Loading templates…</div>}

          {!loading && !shown.length && (
            <EmptyState icon={MessageSquareText} title="No reply templates yet">
              {search || category ? 'Try a different search or category.' : 'Create your first template with the form.'}
            </EmptyState>
          )}

          {!loading && shown.length > 0 && (
            <ul className="template-list">
              {shown.map((template) => (
                <li key={template.templateId} className={editingId === template.templateId ? 'is-editing' : ''}>
                  <div className="template-list__head">
                    <div>
                      <strong>{template.title}</strong>
                      <small>
                        {template.category} · updated {formatDateTime(template.updatedAt)}
                        {template.creator?.name ? ` · by ${template.creator.name}` : ''}
                      </small>
                    </div>
                    <StatusBadge kind="template" status={template.isActive ? 'Active' : 'Inactive'} size="sm" />
                  </div>
                  {template.subject && <p className="template-list__subject">Subject: {template.subject}</p>}
                  <p className="template-list__body">{template.body}</p>
                  <div className="row-actions">
                    <button type="button" title="Duplicate" aria-label={`Duplicate ${template.title}`} onClick={() => duplicate(template)}>
                      <Copy size={16} />
                    </button>
                    {canChange(template) && (
                      <>
                        <button type="button" title="Edit" aria-label={`Edit ${template.title}`} onClick={() => edit(template)}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="danger" title="Delete" aria-label={`Delete ${template.title}`} onClick={() => remove(template)}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
