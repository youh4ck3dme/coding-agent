import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { MessageContent } from './MessageContent';

type Mode = 'ask' | 'plan' | 'apply';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tools?: string[];
  error?: boolean;
  suggestions?: string[];
};

type Project = {
  name: string;
  path: string;
};

const MODE_LABELS: Record<Mode, string> = {
  ask: 'Ask',
  plan: 'Plan',
  apply: 'Apply'
};

const SUGGESTIONS = [
  'Aké balíky sú v packages/?',
  'V akom stave je agent-core?',
  'Naplánuj nový MCP endpoint'
];

/**
 * Main chat shell for the coding agent web UI.
 *
 * - Modes: ask (Q&A), plan (change plan), apply (writes with optional auto-approve).
 * - Project picker selects the MCP workspace root sent with each /api/chat request.
 * - Messages are rendered as plain text via {@link MessageContent} (no raw HTML).
 * - Auto-scroll follows new messages only when the user is already near the bottom.
 */
export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content:
        'Som pripravený. Opýtaj sa na kód, nechaj si naplánovať zmenu alebo ju rovno aplikuj. Odpovedám spisovne, vecne a zrozumiteľne — aj pre netechnikov.'
    }
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('ask');
  const [loading, setLoading] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/health')
      .then(res => res.json())
      .then(data => setOnline(Boolean(data.ok)))
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => {
        if (!res.ok) {
          throw new Error('Projektový katalóg nie je dostupný');
        }
        return res.json() as Promise<{ projects: Project[]; selectedProject: string }>;
      })
      .then(data => {
        setProjects(data.projects);
        const savedPath = localStorage.getItem('coding-agent:selected-project');
        const savedProject = data.projects.find(project => project.path === savedPath);
        setSelectedProject(
          savedProject ?? data.projects.find(project => project.path === data.selectedProject) ?? null
        );
      })
      .catch(() => setProjects([]));
  }, []);

  useAutoScroll(scrollRef, scrollEndRef, [messages.length, loading]);

  const visibleProjects = useMemo(() => {
    const query = projectQuery.trim().toLocaleLowerCase();
    if (!query) {
      return projects;
    }
    return projects.filter(project =>
      `${project.name} ${project.path}`.toLocaleLowerCase().includes(query)
    );
  }, [projectQuery, projects]);

  function selectProject(project: Project) {
    setSelectedProject(project);
    localStorage.setItem('coding-agent:selected-project', project.path);
    setProjectPickerOpen(false);
    setProjectQuery('');
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          message: trimmed,
          autoApprove,
          workspaceRoot: selectedProject?.path
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Request failed');
      }
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: payload.text || '(Žiadna textová odpoveď)',
          tools: payload.toolCalls?.map((t: { name: string }) => t.name),
          suggestions: Array.isArray(payload.suggestions) ? payload.suggestions.slice(0, 3) : []
        }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Neznáma chyba',
          error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[60%] h-[40%] rounded-full bg-indigo-900/10 blur-[120px]" />
        <div className="absolute inset-0 bg-ambient-glow opacity-60" />
      </div>

      <header className="relative z-10 shrink-0 px-4 pt-4 pb-2 md:px-6">
        <div className="glass-panel px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium">
              Coding Agent
            </p>
            <h1 className="text-sm font-semibold tracking-tight text-gradient-brand">
              AI Builder Studio
            </h1>
          </div>
          <div className="relative flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setProjectPickerOpen(open => !open)}
              aria-expanded={projectPickerOpen}
              aria-controls="project-picker"
              className="max-w-[13rem] inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 text-zinc-300 transition-colors hover:border-indigo-500/50 hover:text-zinc-100"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              <span className="truncate">{selectedProject?.name ?? 'Vybrať projekt'}</span>
              <span aria-hidden="true" className="text-zinc-500">⌄</span>
            </button>
            {projectPickerOpen && (
              <div
                id="project-picker"
                className="absolute right-0 top-[calc(100%+0.6rem)] z-20 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-800 bg-[#09090b]/95 p-2 shadow-2xl backdrop-blur-xl"
              >
                <div className="px-2 pb-2">
                  <p className="text-xs font-medium text-zinc-200">Lokálne projekty</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Vybraný projekt je pracovný priestor agenta.</p>
                </div>
                <input
                  value={projectQuery}
                  onChange={event => setProjectQuery(event.target.value)}
                  autoFocus
                  placeholder="Filtrovať projekty…"
                  className="mb-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-500/50"
                />
                <div className="max-h-72 overflow-y-auto">
                  {visibleProjects.map(project => {
                    const selected = project.path === selectedProject?.path;
                    return (
                      <button
                        key={project.path}
                        type="button"
                        onClick={() => selectProject(project)}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                          selected
                            ? 'bg-indigo-500/15 text-indigo-100'
                            : 'text-zinc-300 hover:bg-zinc-800/70'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-indigo-400' : 'bg-zinc-700'}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{project.name}</span>
                          <span className="block truncate text-[10px] text-zinc-500">{project.path}</span>
                        </span>
                        {selected && <span className="ml-auto text-xs text-indigo-300">✓</span>}
                      </button>
                    );
                  })}
                  {visibleProjects.length === 0 && (
                    <p className="px-3 py-5 text-center text-xs text-zinc-500">Nenašiel sa žiadny projekt.</p>
                  )}
                </div>
              </div>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                online
                  ? 'border-emerald-900/50 bg-emerald-950/30 text-emerald-400'
                  : online === false
                    ? 'border-red-900/50 bg-red-950/30 text-red-400'
                    : 'border-zinc-800 text-zinc-500'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              {online ? 'Online' : online === false ? 'Offline' : '…'}
            </span>
          </div>
        </div>
      </header>

      <main
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0"
      >
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[min(100%,42rem)] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-indigo-500/20 text-zinc-100 shadow-premium-glow'
                  : message.role === 'system'
                    ? 'glass-panel text-zinc-400 text-xs'
                    : message.error
                      ? 'bg-red-950/30 border border-red-900/40 text-red-300'
                      : 'bg-[#09090b]/90 border border-zinc-800/80 text-zinc-200'
              }`}
            >
              <MessageContent content={message.content} />
              {message.tools && message.tools.length > 0 && (
                <p className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500">
                  Tools: {message.tools.join(', ')}
                </p>
              )}
            </div>
            {message.role === 'assistant' &&
              !message.error &&
              index === messages.length - 1 &&
              message.suggestions &&
              message.suggestions.length >= 2 && (
                <div className="mt-2 flex max-w-[min(100%,42rem)] flex-wrap gap-2" aria-label="Odporúčané pokračovanie">
                  {message.suggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendMessage(suggestion)}
                      disabled={loading}
                      title="Vykonať túto otázku"
                      className="group inline-flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-3 py-2 text-left text-xs text-indigo-200 transition-colors hover:border-indigo-400/40 hover:bg-indigo-950/40 disabled:opacity-40"
                    >
                      <span>{suggestion}</span>
                      <span
                        aria-hidden="true"
                        className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-400/25 bg-indigo-500/10 text-sm text-indigo-300 transition-all group-hover:translate-x-0.5 group-hover:border-indigo-300/50 group-hover:bg-indigo-500/20"
                      >
                        →
                      </span>
                    </button>
                  ))}
                </div>
              )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="glass-panel px-4 py-3 flex items-center gap-2 text-xs text-zinc-400">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse [animation-delay:300ms]" />
              </span>
              Agent pracuje…
            </div>
          </div>
        )}

        <div ref={scrollEndRef} aria-hidden="true" className="h-px w-full shrink-0" />

        {messages.length <= 1 && !loading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void sendMessage(suggestion)}
                className="text-xs px-3 py-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="relative z-10 shrink-0 p-4 md:p-6 pt-2">
        <div className="glass-panel p-3 shadow-premium-dock">
          <div className="flex items-center gap-1 mb-3 p-1 rounded-xl bg-black/40 border border-zinc-800/60">
            {(['ask', 'plan', 'apply'] as Mode[]).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${
                  mode === item
                    ? 'bg-gradient-to-r from-violet-600/30 to-indigo-600/30 text-zinc-100 border border-indigo-500/30 shadow-premium-glow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {MODE_LABELS[item]}
              </button>
            ))}
          </div>

          {mode === 'apply' && (
            <label className="flex items-center gap-2 mb-3 text-xs text-zinc-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={event => setAutoApprove(event.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/30"
              />
              Automaticky schváliť zápisy do súborov
            </label>
          )}

          <form onSubmit={onSubmit} className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              rows={2}
              placeholder={
                mode === 'ask'
                  ? 'Opýtaj sa na kód…'
                  : mode === 'plan'
                    ? 'Opíš zmenu na naplánovanie…'
                    : 'Opíš zmenu na aplikovanie…'
              }
              className="flex-1 resize-none rounded-xl bg-[#020202] border border-zinc-800/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 shadow-premium-glow"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 h-[52px] px-5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-premium-glow"
            >
              Odoslať
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
