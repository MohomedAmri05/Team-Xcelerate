import { NotebookPen, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { api, errorMessage } from '../services/api';
import { useConfirm } from './ui/ConfirmDialog';

/*
|--------------------------------------------------------------------------
| VIVA – M.R.M. Amri – Wishlists (CRUD resource 3)
|--------------------------------------------------------------------------
| Shown under each saved vehicle on the My Wishlist page.
|   UPDATE  "Add note" / "Edit note" → PATCH  /api/v1/wishlist/:vehicleId
|   DELETE  "Remove"                 → DELETE /api/v1/wishlist/:vehicleId
| (CREATE is the heart button on a vehicle; READ is the wishlist page.)
*/

const MAX = 255;

export default function WishlistNote({ item, onChanged }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note || '');
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.patch(`/wishlist/${item.vehicleId}`, { note: note.trim() || null });
      toast.success(note.trim() ? 'Note saved' : 'Note removed');
      setEditing(false);
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the note'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const vehicle = item.vehicle ? `${item.vehicle.year} ${item.vehicle.make} ${item.vehicle.model}` : 'this vehicle';
    const confirmed = await confirm({
      title: 'Remove from wishlist?',
      message: `${vehicle} and your note will be removed from your wishlist.`,
      confirmLabel: 'Remove',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/wishlist/${item.vehicleId}`);
      toast.success('Vehicle removed from your wishlist');
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove the vehicle'));
    }
  };

  if (editing) {
    return (
      <form className="wishlist-note wishlist-note--editing" onSubmit={save}>
        <label htmlFor={`wishlist-note-${item.wishlistId}`}>Private note</label>
        <textarea
          id={`wishlist-note-${item.wishlistId}`}
          value={note}
          maxLength={MAX}
          rows={3}
          placeholder="e.g. Ask about the service history and spare key"
          onChange={(event) => setNote(event.target.value)}
          autoFocus
        />
        <div className="wishlist-note__footer">
          <small>{note.length}/{MAX}</small>
          <div className="actions">
            <button type="button" className="button ghost" onClick={() => { setNote(item.note || ''); setEditing(false); }}>
              <X size={15} /> Cancel
            </button>
            <button type="submit" className="button" disabled={saving}>
              <Save size={15} /> {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="wishlist-note">
      {item.note ? <p className="wishlist-note__text">{item.note}</p> : <p className="wishlist-note__empty">No note yet.</p>}
      <div className="actions">
        <button type="button" className="button ghost" onClick={() => setEditing(true)}>
          <NotebookPen size={15} /> {item.note ? 'Edit note' : 'Add note'}
        </button>
        <button type="button" className="button ghost danger" onClick={remove}>
          <Trash2 size={15} /> Remove
        </button>
      </div>
    </div>
  );
}
