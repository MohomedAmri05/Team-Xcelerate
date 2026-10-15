import { Check, Minus } from 'lucide-react';

import StatusBadge from '../ui/StatusBadge';

/*
|--------------------------------------------------------------------------
| VIVA-UI – M.R. Ahamed – Staff Permissions › matrix view
|--------------------------------------------------------------------------
| One table: every Staff member (rows) against the 8 permissions (columns).
| Rows are read-only until "Edit"; then ticking a box changes it on screen
| and "Save" writes it with the same PUT/POST as the card view, so Undo
| works the same way. "Cancel" drops the unsaved ticks.
*/

export default function PermissionMatrix({ rows, fields, values, dirty, savingId, editingId, onToggle, onSave, onEdit, onCancel }) {
  return (
    <div className="table-wrap permission-matrix">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Staff member</th>
            {fields.map((field) => (
              <th key={field.key} scope="col" title={field.description}>
                <span className="matrix-head">{field.short || field.label}</span>
              </th>
            ))}
            <th scope="col">Granted</th>
            <th scope="col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const current = values[row.user.userId] || row.permissions;
            const granted = fields.filter((field) => current[field.key]).length;
            const editing = editingId === row.user.userId;
            const state = row.user.accountState || (row.user.isActive ? 'Active' : 'Inactive');

            return (
              <tr key={row.user.userId} className={`${editing && dirty[row.user.userId] ? 'is-dirty' : ''} ${editing ? 'is-editing' : ''}`}>
                <th scope="row">
                  <strong>{row.user.name}</strong>
                  <StatusBadge kind="staff" status={state} size="sm" />
                  <small>
                    {row.user.email}
                    {row.availability?.onLeave && ' · on leave today'}
                    {!row.exists && ' · no record yet'}
                  </small>
                </th>
                {fields.map((field) => (
                  <td key={field.key} className="matrix-cell">
                    <label className="matrix-box" title={`${field.label} – ${row.user.name}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(current[field.key])}
                        disabled={!editing || !row.user.isActive}
                        aria-label={`${field.label} for ${row.user.name}`}
                        onChange={(event) => onToggle(row.user.userId, field.key, event.target.checked)}
                      />
                      {current[field.key] ? <Check size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
                    </label>
                  </td>
                ))}
                <td className="num">
                  {granted}/{fields.length}
                </td>
                <td className="matrix-actions">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="button ghost"
                        disabled={!dirty[row.user.userId] || savingId === row.user.userId || !row.user.isActive}
                        onClick={() => onSave(row)}
                      >
                        {savingId === row.user.userId ? 'Saving…' : row.exists ? 'Save' : 'Create'}
                      </button>
                      <button type="button" className="button ghost" onClick={() => onCancel(row)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={!row.user.isActive}
                      aria-label={`Edit permissions for ${row.user.name}`}
                      onClick={() => onEdit(row)}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
