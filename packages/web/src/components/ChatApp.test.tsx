import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatApp from './ChatApp';

const projectsPayload = {
  projects: [{ name: 'coding-agent', path: '/Users/demo/coding-agent' }],
  selectedProject: '/Users/demo/coding-agent'
};

function mockFetch(handlers: Record<string, () => Response | Promise<Response>>) {
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
    return Promise.resolve(new Response(JSON.stringify({ error: 'not found' }), { status: 404 }));
  });
}

describe('ChatApp', () => {
  beforeEach(() => {
    localStorage.clear();
    let id = 0;
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => `test-uuid-${++id}`
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders welcome message and mode controls', async () => {
    vi.stubGlobal('fetch', mockFetch({}));

    render(<ChatApp />);

    expect(
      await screen.findByText(/Som pripravený/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('switches to plan mode', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.click(screen.getByRole('button', { name: 'Plan' }));
    expect(screen.getByPlaceholderText(/naplánovanie/i)).toBeInTheDocument();
  });

  it('sends a message and shows assistant reply', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'POST /api/chat': () =>
          new Response(
            JSON.stringify({
              text: 'Odpoveď agenta',
              toolCalls: [{ name: 'read_file' }]
            }),
            { status: 200 }
          )
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    const input = screen.getByPlaceholderText(/Opýtaj sa na kód/i);
    await user.type(input, 'Čo je v agent-core?');
    await user.click(screen.getByRole('button', { name: 'Odoslať' }));

    expect(await screen.findByText('Čo je v agent-core?')).toBeInTheDocument();
    expect(await screen.findByText('Odpoveď agenta')).toBeInTheDocument();
    expect(screen.getByText(/Tools: read_file/i)).toBeInTheDocument();
  });

  it('shows error bubble when chat request fails', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'POST /api/chat': () =>
          new Response(JSON.stringify({ error: 'Server nedostupný' }), { status: 500 })
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.type(screen.getByPlaceholderText(/Opýtaj sa na kód/i), 'Test');
    await user.click(screen.getByRole('button', { name: 'Odoslať' }));

    expect(await screen.findByText('Server nedostupný')).toBeInTheDocument();
  });

  it('strips HTML from assistant content', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'POST /api/chat': () =>
          new Response(
            JSON.stringify({
              text: 'Bezpečné<script>alert(1)</script> text',
              toolCalls: []
            }),
            { status: 200 }
          )
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.click(screen.getByText('Aké balíky sú v packages/?'));

    await waitFor(() => {
      expect(screen.getByText('Bezpečné text')).toBeInTheDocument();
    });
    expect(screen.queryByText(/script/i)).not.toBeInTheDocument();
  });

  it('shows loading indicator while waiting for response', async () => {
    let resolveChat: (value: Response) => void = () => {};
    const chatPromise = new Promise<Response>(resolve => {
      resolveChat = resolve;
    });

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
          return chatPromise;
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      })
    );
    const user = userEvent.setup();

    render(<ChatApp />);
    await screen.findByText(/Som pripravený/i);

    await user.type(screen.getByPlaceholderText(/Opýtaj sa na kód/i), 'Čakám');
    await user.click(screen.getByRole('button', { name: 'Odoslať' }));

    expect(screen.getByText('Agent pracuje…')).toBeInTheDocument();

    resolveChat(
      new Response(JSON.stringify({ text: 'Hotovo', toolCalls: [] }), { status: 200 })
    );

    expect(await screen.findByText('Hotovo')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Agent pracuje…')).not.toBeInTheDocument();
    });
  });
});