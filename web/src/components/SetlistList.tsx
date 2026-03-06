import { useState, useEffect } from 'react';
import { getSetlists, createSetlist, deleteSetlist } from '@shared/supabase/queries';
import type { Setlist } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

interface SetlistListProps {
  onClose: () => void;
  onSetlistPress: (id: string) => void;
}

export function SetlistList({ onClose, onSetlistPress }: SetlistListProps) {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Setlist | null>(null);

  // Add modal
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadSetlists() {
    try {
      setSetlists(await getSetlists());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load setlists');
    }
  }

  useEffect(() => { loadSetlists(); }, []);

  async function handleCreate() {
    if (!newName.trim()) { setError('Setlist name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await createSetlist({ name: newName.trim(), description: newDescription.trim() });
      setShowForm(false);
      setNewName('');
      setNewDescription('');
      onSetlistPress(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSetlist(deleteTarget.id);
      setDeleteTarget(null);
      await loadSetlists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleteTarget(null);
    }
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Setlists</h2>
        <div className="page-header-spacer" />
      </div>

      <button className="btn btn-primary btn-small btn-full" onClick={() => { setNewName(''); setNewDescription(''); setShowForm(true); }} style={{ marginBottom: 12 }}>
        + New Setlist
      </button>

      {error && <ErrorAlert message={error} compact />}

      <div className="setlist-list-items">
        {setlists.map(sl => (
          <div key={sl.id} className="setlist-card neu-card">
            <div className="setlist-card-info" onClick={() => onSetlistPress(sl.id)} style={{ cursor: 'pointer' }}>
              <span className="setlist-card-name">{sl.name}</span>
              {sl.description && <span className="setlist-card-desc">{sl.description}</span>}
            </div>
            <div className="setlist-card-actions">
              <button className="btn btn-small btn-tangerine" onClick={() => onSetlistPress(sl.id)}>Open</button>
              <button className="btn btn-small btn-danger" onClick={() => setDeleteTarget(sl)}>Del</button>
            </div>
          </div>
        ))}
        {setlists.length === 0 && (
          <p className="empty-text">No setlists yet</p>
        )}
      </div>

      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">New Setlist</h3>

            <label className="label">SETLIST NAME *</label>
            <div className="neu-inset">
              <input className="input-field" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Friday Night Set" />
            </div>

            <label className="label">DESCRIPTION</label>
            <div className="neu-inset">
              <input className="input-field" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Optional" />
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.name}"? All songs in this setlist will be unlinked.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
