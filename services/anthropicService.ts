import Anthropic from '@anthropic-ai/sdk';

export const getAnthropicKey = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ZEREO_ANTHROPIC_KEY') || '';
  }
  return '';
};

export const getAnthropic = () => {
  const apiKey = getAnthropicKey();
  if (!apiKey) return null;
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true // Since we are calling from frontend as per guidelines
  });
};

export interface ClaudeTurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const generateClaudeContent = async (
  prompt: string,
  systemInstruction: string,
  history?: ClaudeTurnMessage[]
) => {
  const anthropic = getAnthropic();
  if (!anthropic) {
    throw new Error("AUTH_ERROR: Principal, the Anthropic neural bridge is not anchored. Please provide a key in System Control.");
  }

  const messages: ClaudeTurnMessage[] =
    history && history.length > 0
      ? history
      : [{ role: 'user', content: prompt }];

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4096,
      system: systemInstruction,
      messages,
    });

    // Extract text content
    const textContent = message.content.find(c => c.type === 'text');
    return textContent ? (textContent as any).text : '';
  } catch (err: any) {
    console.error("anthropicService: generateContent error:", err);
    throw err;
  }
};
