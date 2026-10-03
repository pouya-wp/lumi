import { ServiceUnavailableException } from '@nestjs/common';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/** Minimal chat-completion interface so the OpenAI client can be swapped (or mocked in tests). */
export interface AiProvider {
  readonly enabled: boolean;
  readonly model: string;
  complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** OpenAI-compatible Chat Completions client (OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL). */
export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string | undefined,
    readonly model: string,
    private readonly baseUrl: string,
  ) {}

  get enabled() {
    return !!this.apiKey;
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}) {
    if (!this.apiKey) throw new ServiceUnavailableException('AI is not configured');
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1200,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceUnavailableException(`AI provider error ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content ?? '';
  }
}

/** Deterministic provider for tests and offline demos (AI_PROVIDER=mock). */
export class MockAiProvider implements AiProvider {
  readonly enabled = true;
  readonly model = 'mock';

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}) {
    const last = messages[messages.length - 1]?.content ?? '';
    if (opts.json && last.includes('TASK_PARSE')) {
      return JSON.stringify({ title: 'گزارش فروش', priority: 'HIGH', dueInDays: 1, dueTime: '10:00', assigneeNames: [], labels: ['فروش'], subtasks: ['جمع‌آوری داده', 'نوشتن گزارش'] });
    }
    if (opts.json && last.includes('BREAKDOWN')) {
      return JSON.stringify({ subtasks: [{ title: 'Research', estimateMin: 60 }, { title: 'Implement', estimateMin: 120 }, { title: 'Review', estimateMin: 30 }] });
    }
    return `MOCK: ${last.slice(0, 80)}`;
  }
}

export function createProvider(): AiProvider {
  if (process.env.AI_PROVIDER === 'mock') return new MockAiProvider();
  return new OpenAiProvider(process.env.OPENAI_API_KEY || undefined, process.env.OPENAI_MODEL || 'gpt-4.1-mini', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
}
