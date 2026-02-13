'use server';

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSocialContent(transcription: string) {
  const prompt = `
    Based on the following video transcription, generate:
    1. A viral Twitter thread (3-5 tweets).
    2. An engaging Instagram caption with hashtags.
    3. A professional LinkedIn post.

    Transcription: "${transcription}"

    Format the response as a JSON object with keys: twitter, instagram, linkedin.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = JSON.parse(response.choices[0].message.content || '{}');
    return content;
  } catch (error) {
    console.error('Content generation error:', error);
    throw new Error('Failed to generate social content');
  }
}
