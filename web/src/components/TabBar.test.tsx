// @vitest-environment jsdom
//
// NOTE: @testing-library/react is present but its required peer
// @testing-library/dom is NOT installed in this project, so RTL's render()
// fails at runtime. To keep this slice dependency-free (hub npm-supply-chain
// rule) we drive the component with raw react-dom/client + React 19's act().
// The assertions are exactly the spec's: 4 tabs, active follows the view,
// clicking a tab switches the rendered view.
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ViewProvider, useView } from '../hooks/useViewContext';
import { TabBar } from './TabBar';

// React's act() requires this flag in a bare (non-RTL) test environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Probe that surfaces the current view so we can assert nav transitions.
function ViewProbe() {
  const { view } = useView();
  return <div data-testid="current-view">{view}</div>;
}

let container: HTMLDivElement;
let root: Root;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <ViewProvider>
        <TabBar />
        <ViewProbe />
      </ViewProvider>,
    );
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('TabBar', () => {
  it('renders exactly 4 tabs with the expected labels', () => {
    mount();
    const items = [...container.querySelectorAll('.tab-item')];
    expect(items).toHaveLength(4);
    const text = items.map(i => i.textContent ?? '');
    for (const label of ['Calendar', 'Gigs', 'Money', 'More']) {
      expect(text.some(t => t.includes(label))).toBe(true);
    }
  });

  it('marks the tab matching the current view active (calendar by default)', () => {
    mount();
    const active = container.querySelector('.tab-item.active');
    expect(active?.textContent).toContain('Calendar');
  });

  it('switches the rendered view when a tab is clicked', () => {
    mount();
    const currentView = () => container.querySelector('[data-testid="current-view"]')?.textContent;
    expect(currentView()).toBe('calendar');

    const gigs = [...container.querySelectorAll('.tab-item')]
      .find(i => i.textContent?.includes('Gigs')) as HTMLElement | undefined;
    expect(gigs).toBeTruthy();
    act(() => { gigs!.click(); });

    expect(currentView()).toBe('list');
    // active tab follows the view
    expect(container.querySelector('.tab-item.active')?.textContent).toContain('Gigs');
  });
});
