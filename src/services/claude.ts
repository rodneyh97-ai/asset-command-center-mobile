import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

export async function getFeedback(
  apiKey: string,
  systemPrompt: string,
  userInput: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userInput,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }
  return textBlock.text;
}
