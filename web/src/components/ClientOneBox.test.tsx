// @vitest-environment jsdom
// Raw react-dom pattern (RTL's @testing-library/dom peer is not installed).
import { describe, it, expect, afterEach } from 'vitest';
import { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ClientOneBox, type ClientOneBoxValue } from './ClientOneBox';
import type { Client } from '@shared/supabase/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const client = (id: string, company_name: string, contact_name = ''): Client =>
  ({ id, company_name, contact_name, address: '', email: '', phone: '', created_by: '', created_at: '' });

const clients: Client[] = [client('c1', 'The Anchor Pub', 'Sam'), client('c2', 'Riverside Weddings', 'Jo')];

let lastValue: ClientOneBoxValue = { client_id: null, client_name: '' };
let container: HTMLDivElement;
let root: Root;

function Harness({ initial }: { initial: ClientOneBoxValue }) {
  const [v, setV] = useState<ClientOneBoxValue>(initial);
  return <ClientOneBox value={v} clients={clients} onChange={nv => { lastValue = nv; setV(nv); }} />;
}

function mount(initial: ClientOneBoxValue) {
  lastValue = initial;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness initial={initial} />));
}
afterEach(() => { act(() => root.unmount()); container.remove(); });

// Drive a controlled React input without RTL.
function type(text: string) {
  const input = container.querySelector('input') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ClientOneBox', () => {
  it('renders matching clients as you type', () => {
    mount({ client_id: null, client_name: '' });
    type('anchor');
    const opts = container.querySelectorAll('.autocomplete-option');
    expect(opts).toHaveLength(1);
    expect(opts[0].textContent).toContain('The Anchor Pub');
  });

  it('picking a match sets client_id + name', () => {
    mount({ client_id: null, client_name: '' });
    type('riverside');
    const opt = container.querySelector('.autocomplete-option') as HTMLElement;
    act(() => { opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(lastValue.client_id).toBe('c2');
    expect(lastValue.client_name).toBe('Riverside Weddings');
  });

  it('free text leaves client_id null (unlinks a previously linked client)', () => {
    mount({ client_id: 'c1', client_name: 'The Anchor Pub' });
    type('Some New Venue Co');
    expect(lastValue.client_id).toBeNull();
    expect(lastValue.client_name).toBe('Some New Venue Co');
  });
});
