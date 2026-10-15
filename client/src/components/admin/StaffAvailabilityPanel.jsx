import { CalendarOff, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../../services/api';
import { useConfirm } from '../ui/ConfirmDialog';

/*
|--------------------------------------------------------------------------
| VIVA-UI – M.R.M. Amri – Staff availability (Admin, Bookings tab)
|--------------------------------------------------------------------------
|   CREATE "Add leave"  → POST   /api/v1/staff-leave
|   READ   upcoming leave → GET  /api/v1/staff-leave
|   DELETE "Remove"     → DELETE /api/v1/staff-leave/:id
| A Staff member on leave on a booking's date shows as "Not available" in
| the Assigned staff drop-down and cannot be assigned. Busy times are
| worked out automatically from the bookings already assigned.
*/

function localDate(offsetDays = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const formatDay = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const emptyForm = () => ({ staffId: '', startDate: localDate(), endDate: localDate(), reason: '' });

export default function StaffAvailabilityPanel({ onChanged }) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState([]);
  const [leave, setLeave] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [staffResponse, leaveResponse] = await Promise.all([
        api.get('/staff-permissions', { params: { date: localDate() } }),
        api.get('/staff-leave', { params: { from: localDate() } })
      ]);

      setStaff((staffResponse.data.data || []).map((row) => ({ ...row.user, availability: row.availability })));
      setLeave(leaveResponse.data.data || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load staff availability'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (field, value) =>
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'startDate' && next.endDate < value) {
        next.endDate = value;
      }

      return next;
    });

  const addLeave = async (event) => {
    event.preventDefault();

    if (!form.staffId) {
      toast.error('Choose a Staff member');
      return;
    }

    setSaving(true);

    try {
      const response = await api.post('/staff-leave', {
        staffId: Number(form.staffId),
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || null
      });

      const affected = response.data.meta?.affectedBookings || [];
      (affected.length ? toast : toast.success)(response.data.message, affected.length ? { icon: '⚠️', duration: 8000 } : undefined);

      setForm(emptyForm());
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the leave'));
    } finally {
      setSaving(false);
    }
  };

  const removeLeave = async (entry) => {
    const confirmed = await confirm({
      title: 'Remove this leave?',
      message: `${entry.staff?.name || 'This Staff member'} will be available again from ${formatDay(entry.startDate)} to ${formatDay(entry.endDate)}.`,
      confirmLabel: 'Remove leave'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/staff-leave/${entry.leaveId}`);
      toast.success('Leave removed');
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove the leave'));
    }
  };

  const activeStaff = staff.filter((member) => member.isActive);
  const offToday = staff.filter((member) => member.availability?.onLeave).length;

  return (
    <section className={`panel staff-availability ${open ? 'is-open' : ''}`} aria-label="Staff availability">
      <button type="button" className="staff-availability__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <CalendarOff aria-hidden="true" />
        <span>
          <strong>Staff availability</strong>
          <small>
            {loading
              ? 'Loading…'
              : `${activeStaff.length} active Staff · ${offToday} on leave today · ${leave.length} upcoming leave ${leave.length === 1 ? 'entry' : 'entries'}`}
          </small>
        </span>
        <ChevronDown className="staff-availability__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="staff-availability__body">
          <p className="muted">
            Mark the days a Staff member is off. They show as “Not available” for test drives on those days. Busy times are worked out
            automatically: nobody can be given two test drives within an hour of each other.
          </p>

          <form className="staff-leave-form" onSubmit={addLeave}>
            <label>
              Staff member
              <select value={form.staffId} onChange={(event) => update('staffId', event.target.value)} required aria-label="Staff member on leave">
                <option value="">Choose…</option>
                {activeStaff.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              First day
              <input type="date" min={localDate()} value={form.startDate} onChange={(event) => update('startDate', event.target.value)} required />
            </label>

            <label>
              Last day
              <input type="date" min={form.startDate} value={form.endDate} onChange={(event) => update('endDate', event.target.value)} required />
            </label>

            <label className="staff-leave-form__reason">
              Reason (optional)
              <input type="text" maxLength="150" placeholder="Annual leave, sick, training…" value={form.reason} onChange={(event) => update('reason', event.target.value)} />
            </label>

            <button className="button" type="submit" disabled={saving}>
              <Plus size={17} />
              {saving ? 'Saving…' : 'Add leave'}
            </button>
          </form>

          {!loading && leave.length === 0 && <p className="state">No upcoming leave.</p>}

          {leave.length > 0 && (
            <div className="table-wrap">
              <table className="data-table staff-leave-table">
                <thead>
                  <tr>
                    <th scope="col">Staff member</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Reason</th>
                    <th scope="col" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {leave.map((entry) => (
                    <tr key={entry.leaveId}>
                      <th scope="row">{entry.staff?.name || `Staff #${entry.staffId}`}</th>
                      <td>{formatDay(entry.startDate)}</td>
                      <td>{formatDay(entry.endDate)}</td>
                      <td>{entry.reason || <span className="muted">—</span>}</td>
                      <td>
                        <button type="button" className="button ghost danger" onClick={() => removeLeave(entry)} aria-label={`Remove leave for ${entry.staff?.name}`}>
                          <Trash2 size={16} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
