import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';
const MAX_INPUT_CHARS = 4000;

export async function getFeedback(
  apiKey: string,
  systemPrompt: string,
  userInput: string,
  signal?: AbortSignal,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const sanitizedInput = userInput.slice(0, MAX_INPUT_CHARS);

  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: sanitizedInput }],
    },
    { signal },
  );

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response received.');
  }
  return textBlock.text;
}
