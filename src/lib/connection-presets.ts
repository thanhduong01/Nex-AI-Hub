import type { Provider } from './types';

// Text-only standard API rates, USD / million tokens; not a live pricing feed.
// Reviewed 2026-11-03. Persist a copy with each connection; never change existing rates.
export const CONNECTION_PRESETS = {
  openai: {
    name: 'OpenAI',
    model: 'gpt-4.1-mini',
    modelLabel: 'GPT-4.1 mini',
    description: 'Viết nội dung, tóm tắt và trao đổi hằng ngày.',
    input_price: 0.4,
    output_price: 1.6,
    keyUrl: 'https://platform.openai.com/api-keys',
    pricingUrl: 'https://developers.openai.com/api/docs/models/gpt-4.1-mini',
  },
  anthropic: {
    name: 'Claude',
    model: 'claude-haiku-4-5-20251001',
    modelLabel: 'Claude Haiku 4.5',
    description: 'Phân tích, biên tập và xử lý nội dung công việc.',
    input_price: 1,
    output_price: 5,
    keyUrl: 'https://platform.claude.com/settings/keys',
    pricingUrl: 'https://platform.claude.com/docs/en/models/haiku-4-5/overview',
  },
  google: {
    name: 'Gemini',
    model: 'gemini-2.5-flash-lite',
    modelLabel: 'Gemini 2.5 Flash-Lite',
    description: 'Phản hồi nhanh cho các tác vụ văn bản cơ bản.',
    input_price: 0.1,
    output_price: 0.4,
    keyUrl: 'https://aistudio.google.com/apikey',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-lite',
  },
} satisfies Record<
  Provider,
  {
    name: string;
    model: string;
    modelLabel: string;
    description: string;
    input_price: number;
    output_price: number;
    keyUrl: string;
    pricingUrl: string;
  }
>;

export const PRESET_REVIEWED_ON = '03/11/2026';
