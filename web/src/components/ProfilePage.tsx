import { useState, useEffect } from 'react';
import { getCurrentProfile, updateProfile } from '@shared/supabase/queries';
import type { Profile } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';

interface ProfilePageProps {
  userEmail: string;
  onClose: () => void;
  onSignOut: () => void;
}

export function ProfilePage({ userEmail, onClose, onSignOut }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [bandRole, setBandRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentProfile().then(p => {
      if (p) {
        setProfile(p);
        setName(p.name);
        setBandRole(p.band_role ?? '');
      }
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateProfile({ name, band_role: bandRole });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Profile</h2>
        <div className="page-header-spacer" />
      </div>

      {profile && (
        <>
          <label className="label" htmlFor="profile-name">NAME</label>
          <div className="neu-inset">
            <input
              id="profile-name"
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <label className="label" htmlFor="profile-role">BAND ROLE</label>
          <div className="neu-inset">
            <input
              id="profile-role"
              className="input-field"
              value={bandRole}
              onChange={e => setBandRole(e.target.value)}
              placeholder="e.g. Lead Guitar & Backing Vocals"
            />
          </div>

          <label className="label">EMAIL</label>
          <div className="neu-inset">
            <div className="input-field input-field-readonly">
              {userEmail}
            </div>
          </div>

          {error && <ErrorAlert message={error} compact />}
          {saved && <p className="saved-text">Saved!</p>}

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-danger" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
