import { useState, useEffect } from 'react';
import {
  getClients, createClient, updateClient, deleteClient, searchClients,
  getVenuesForClient, createVenue, deleteVenue,
} from '@shared/supabase/queries';
import type { Client, Venue } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

interface ClientListProps {
  onClose: () => void;
}

export function ClientList({ onClose }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Edit/add modal
  const [editing, setEditing] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Venue management
  const [venueClient, setVenueClient] = useState<Client | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  async function loadClients() {
    try {
      const list = search.trim() ? await searchClients(search.trim()) : await getClients();
      setClients(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    }
  }

  useEffect(() => { loadClients(); }, [search]);

  function openAdd() {
    setEditing(null);
    setCompanyName(''); setContactName(''); setAddress(''); setEmail(''); setPhone('');
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setCompanyName(client.company_name);
    setContactName(client.contact_name);
    setAddress(client.address);
    setEmail(client.email);
    setPhone(client.phone);
    setShowForm(true);
  }

  async function handleSave() {
    if (!companyName.trim()) { setError('Company name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateClient(editing.id, {
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          address: address.trim(),
          email: email.trim(),
          phone: phone.trim(),
        });
      } else {
        await createClient({
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          address: address.trim(),
          email: email.trim(),
          phone: phone.trim(),
        });
      }
      setShowForm(false);
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteClient(deleteTarget.id);
      setDeleteTarget(null);
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleteTarget(null);
    }
  }

  async function openVenues(client: Client) {
    setVenueClient(client);
    try {
      const v = await getVenuesForClient(client.id);
      setVenues(v);
    } catch {
      setVenues([]);
    }
  }

  async function handleAddVenue() {
    if (!venueClient || !newVenueName.trim()) return;
    try {
      await createVenue(venueClient.id, newVenueName.trim(), newVenueAddress.trim() || undefined);
      setNewVenueName('');
      setNewVenueAddress('');
      const v = await getVenuesForClient(venueClient.id);
      setVenues(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add venue');
    }
  }

  async function handleDeleteVenue(venueId: string) {
    if (!venueClient) return;
    try {
      await deleteVenue(venueId);
      const v = await getVenuesForClient(venueClient.id);
      setVenues(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete venue');
    }
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Clients</h2>
        <div className="page-header-spacer" />
      </div>

      <div className="neu-inset" style={{ marginBottom: 8 }}>
        <input
          className="input-field"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients..."
        />
      </div>

      <button className="btn btn-primary btn-small btn-full" onClick={openAdd} style={{ marginBottom: 12 }}>
        + Add Client
      </button>

      {error && <ErrorAlert message={error} compact />}

      <div className="client-list-items">
        {clients.map(client => (
          <div key={client.id} className="client-card neu-card">
            <div className="client-card-info">
              <span className="client-card-name">{client.company_name}</span>
              {client.contact_name && <span className="client-card-contact">{client.contact_name}</span>}
              {client.address && <span className="client-card-address">{client.address}</span>}
              {client.email && <span className="client-card-email">{client.email}</span>}
            </div>
            <div className="client-card-actions">
              <button className="btn btn-small btn-outline" onClick={() => openVenues(client)}>Venues</button>
              <button className="btn btn-small btn-tangerine" onClick={() => openEdit(client)}>Edit</button>
              <button className="btn btn-small btn-danger" onClick={() => setDeleteTarget(client)}>Del</button>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <p className="empty-text">{search ? 'No matching clients' : 'No clients yet'}</p>
        )}
      </div>

      {/* Add/Edit Client Modal */}
      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{editing ? 'Edit Client' : 'New Client'}</h3>

            <label className="label">COMPANY NAME *</label>
            <div className="neu-inset">
              <input className="input-field" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" />
            </div>

            <label className="label">CONTACT NAME</label>
            <div className="neu-inset">
              <input className="input-field" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Optional" />
            </div>

            <label className="label">ADDRESS</label>
            <div className="neu-inset">
              <textarea className="input-field input-textarea" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" rows={3} />
            </div>

            <label className="label">EMAIL</label>
            <div className="neu-inset">
              <input className="input-field" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" type="email" />
            </div>

            <label className="label">PHONE</label>
            <div className="neu-inset">
              <input className="input-field" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" type="tel" />
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Venue Management Modal */}
      {venueClient && (
        <div className="overlay" onClick={() => setVenueClient(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Venues for {venueClient.company_name}</h3>

            {venues.map(v => (
              <div key={v.id} className="venue-row">
                <div>
                  <span className="venue-name">{v.venue_name}</span>
                  {v.address && <span className="venue-address">{v.address}</span>}
                </div>
                <button className="btn btn-small btn-danger" onClick={() => handleDeleteVenue(v.id)}>Del</button>
              </div>
            ))}
            {venues.length === 0 && <p className="empty-text">No venues yet</p>}

            <div className="venue-add-form">
              <div className="neu-inset" style={{ marginBottom: 6 }}>
                <input className="input-field" value={newVenueName} onChange={e => setNewVenueName(e.target.value)} placeholder="Venue name" />
              </div>
              <div className="neu-inset" style={{ marginBottom: 6 }}>
                <input className="input-field" value={newVenueAddress} onChange={e => setNewVenueAddress(e.target.value)} placeholder="Address (optional)" />
              </div>
              <button className="btn btn-primary btn-small" onClick={handleAddVenue} disabled={!newVenueName.trim()}>
                + Add Venue
              </button>
            </div>

            <button className="btn btn-outline btn-full" onClick={() => setVenueClient(null)} style={{ marginTop: 12 }}>Close</button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.company_name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
