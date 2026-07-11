import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyViewport, IPHONE_AIR_17 } from '../test/viewports';
import ChatApp from './ChatApp';

const projectsPayload = {
  projects: [
    { name: 'coding-agent', path: '/Users/demo/coding-agent' },
    { name: 'mobile-app', path: '/Users/demo/mobile-app' }
  ],
  selectedProject: '/Users/demo/coding-agent'
};

function mockMobileFetch(
  handlers: Record<string, () => Response | Promise<Response>> = {}
) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;

    if (handlers[key]) {
      return Promise.resolve(handlers[key]());
    }
    if (url.includes('/health') && method === 'GET') {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }
    if (url.includes('/api/projects') && method === 'GET') {
      return Promise.resolve(new Response(JSON.stringify(projectsPayload), { status: 200 }));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

describe('ChatApp on iPhone Air 17 viewport', () => {
  beforeEach(() => {
    applyViewport(IPHONE_AIR_17);
    localStorage.clear();
    let id = 0;
    vi.stubGlobal('fetch', mockMobileFetch());
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => `iphone-air-uuid-${++id}`
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses full dynamic viewport height shell', async () => {
    const { container } = render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('h-[100dvh]');
    expect(window.innerWidth).toBe(420);
    expect(window.innerHeight).toBe(912);
  });

  it('keeps header controls and chat input visible on narrow screen', async () => {
    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    expect(screen.getByRole('button', { name: /coding-agent/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Odoslať' })).toBeVisible();
    expect(screen.getByPlaceholderText(/Opýtaj sa na kód/i)).toBeVisible();
    expect(screen.getByText(/Online/i)).toBeVisible();
  });

  it('opens searchable project picker within mobile width', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.click(screen.getByRole('button', { name: /coding-agent/i }));
    const filter = screen.getByPlaceholderText(/Filtrovať projekty/i);
    expect(filter).toBeVisible();

    await user.type(filter, 'mobile');
    expect(screen.getByRole('button', { name: /mobile-app/i })).toBeVisible();

    await user.click(filter);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    await user.type(filter, 'zzz');
    expect(screen.getByText('Nenašiel sa žiadny projekt.')).toBeVisible();
  });

  it('exposes mode switcher and suggestion chips for thumb reach', async () => {
    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    expect(screen.getByRole('button', { name: 'Ask' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeVisible();
    expect(screen.getByText('Aké balíky sú v packages/?')).toBeVisible();
  });

  it('shows apply auto-approve toggle only in apply mode', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    expect(screen.queryByText(/Automaticky schváliť/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText(/Automaticky schváliť/i)).toBeVisible();
    expect(screen.getByPlaceholderText(/aplikovanie/i)).toBeVisible();
  });

  it('sends a chat message on narrow viewport', async () => {
    vi.stubGlobal(
      'fetch',
      mockMobileFetch({
        'POST /api/chat': () =>
          new Response(
            JSON.stringify({ text: 'Mobilná odpoveď', toolCalls: [] }),
            { status: 200 }
          )
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.type(screen.getByPlaceholderText(/Opýtaj sa na kód/i), 'Test na mobile');
    await user.click(screen.getByRole('button', { name: 'Odoslať' }));

    expect(await screen.findByText('Mobilná odpoveď')).toBeVisible();
  });

  it('sends workspaceRoot after switching project on mobile', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/health')) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        }
        if (url.includes('/api/projects')) {
          return Promise.resolve(new Response(JSON.stringify(projectsPayload), { status: 200 }));
        }
        if (url.includes('/api/chat') && method === 'POST') {
          capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
          return Promise.resolve(
            new Response(JSON.stringify({ text: 'OK', toolCalls: [] }), { status: 200 })
          );
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.click(screen.getByRole('button', { name: /coding-agent/i }));
    await user.click(screen.getByRole('button', { name: /mobile-app/i }));
    await user.type(screen.getByPlaceholderText(/Opýtaj sa na kód/i), 'Mobilný projekt');
    await user.click(screen.getByRole('button', { name: 'Odoslať' }));

    await screen.findByText('OK');
    expect(capturedBody?.workspaceRoot).toBe('/Users/demo/mobile-app');
  });

  it('shows offline badge when health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/health')) {
          return Promise.reject(new Error('network down'));
        }
        if (url.includes('/api/projects')) {
          return Promise.resolve(new Response(JSON.stringify(projectsPayload), { status: 200 }));
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      })
    );

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    expect(await screen.findByText('Offline')).toBeVisible();
  });

  it('submits with Enter key on mobile keyboard', async () => {
    vi.stubGlobal(
      'fetch',
      mockMobileFetch({
        'POST /api/chat': () =>
          new Response(
            JSON.stringify({ text: 'Enter odoslané', toolCalls: [] }),
            { status: 200 }
          )
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    const input = screen.getByPlaceholderText(/Opýtaj sa na kód/i);
    await user.type(input, 'Enter test{Enter}');

    expect(await screen.findByText('Enter odoslané')).toBeVisible();
  });

  it('fires suggestion chip on touch-sized layout', async () => {
    vi.stubGlobal(
      'fetch',
      mockMobileFetch({
        'POST /api/chat': () =>
          new Response(
            JSON.stringify({ text: 'Balíky v packages', toolCalls: [] }),
            { status: 200 }
          )
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.click(screen.getByText('Aké balíky sú v packages/?'));

    expect(await screen.findByText('Balíky v packages')).toBeVisible();
  });
});