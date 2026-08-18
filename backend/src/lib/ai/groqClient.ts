export type GroqMessage = {
  role: 'system' | 'user';
  content: string;
};

export type GroqCallResult = { ok: true; content: string } | { ok: false; error: string };

export type GroqClient = {
  readonly model: string;
  chat(messages: GroqMessage[]): Promise<GroqCallResult>;
};

export type GroqClientOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

const DEFAULT_MODEL = 'llama3-8b-8192';
const DEFAULT_TIMEOUT_MS = 10000;

// Minimal Groq chat-completions client. Groq is the ONLY AI provider.
// Configuration is read from the server environment (never the client):
//   GROQ_API_KEY   required
//   GROQ_MODEL     optional, defaults to llama3-8b-8192
//   GROQ_BASE_URL  optional, defaults to the Groq OpenAI-compatible endpoint
//   GROQ_TIMEOUT_MS optional, defaults to 10000
export function createGroqClient(options: GroqClientOptions = {}): GroqClient {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY ?? '';
  const model = options.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL;
  const baseUrl = (options.baseUrl ?? process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const timeoutMs = Number(options.timeoutMs ?? process.env.GROQ_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return {
    model,
    async chat(messages: GroqMessage[]): Promise<GroqCallResult> {
      if (!apiKey) {
        return { ok: false, error: 'GROQ_API_KEY is not configured' };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return { ok: false, error: `Groq request failed with status ${response.status}` };
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>;
        };
        const content = data?.choices?.[0]?.message?.content;

        if (typeof content !== 'string' || !content.trim()) {
          return { ok: false, error: 'Groq returned no usable content' };
        }

        return { ok: true, content };
      } catch (err) {
        const timedOut = err instanceof Error && err.name === 'AbortError';
        return { ok: false, error: timedOut ? 'Groq request timed out' : 'Groq request failed' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
