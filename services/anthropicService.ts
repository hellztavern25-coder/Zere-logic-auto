
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

export const generateClaudeContent = async (prompt: string, systemInstruction: string) => {
  const anthropic = getAnthropic();
  if (!anthropic) {
    throw new Error("AUTH_ERROR: Principal, the Anthropic neural bridge is not anchored. Please provide a key in System Control.");
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4096,
      system: systemInstruction,
      messages: [
        { role: "user", content: prompt }
      ],
    });

    // Extract text content
    const textContent = message.content.find(c => c.type === 'text');
    return textContent ? (textContent as any).text : '';
  } catch (err: any) {
    console.error("anthropicService: generateContent error:", err);
    throw err;
  }
};
