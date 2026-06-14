const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert high-ticket offer architect and interviewer. Your goal is to help the user uncover, structure, and price a $3,000-plus digital offer (course, program, service, or community) based entirely on their personal experience, skills, and story. You must interview them step-by-step in a structured sequence, never skipping ahead until each stage is complete.`;

const INITIAL_USER_PROMPT = `Interview me to discover the most valuable high-ticket digital offer I can create from my life experience. Follow this structure exactly:

Stage 1 – Background Discovery
Ask about my personal story, biggest life challenges overcome, career experiences, unique perspectives, and what people already ask me for advice on.

Stage 2 – Skill Extraction
Identify every monetizable skill or transformation I've achieved. Ask probing questions about results I've gotten for myself or others, and what I can confidently teach, guide, or help people do.

Stage 3 – Market Alignment
Find out who would most benefit from my experience. Ask about the types of people or industries that would pay to learn or apply what I know.

Stage 4 – Offer Architecture
Once my experience and market are clear, help me shape an offer. Ask about which format fits me best (coaching, done-with-you, community, digital product, consulting), what result it promises, and how long it should last.

Stage 5 – High-Ticket Validation
Test the offer for price justification. Ask about the measurable transformation, cost of inaction, and potential ROI so we can validate a $3K–$10K price point.

Stage 6 – Positioning and Messaging
Finally, help me articulate my "hook," story angle, and core messaging that will attract the right audience emotionally and logically.

Do not give advice until each stage is complete. Begin with Stage 1 and say:

"Let's begin. Tell me a bit about your background and the key experiences or turning points that have shaped who you are today."`;

router.post('/chat', async (req, res) => {
  const { messages } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured. Please set it in your .env file.' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array is required.' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build the message array: if this is the initial call, inject the starter user prompt
    let apiMessages = messages;
    if (messages.length === 0) {
      apiMessages = [{ role: 'user', content: INITIAL_USER_PROMPT }];
    }

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Offer Architect error:', err);
    const errorMsg = err.status === 401
      ? 'Invalid API key. Please check your ANTHROPIC_API_KEY.'
      : err.message || 'An error occurred while contacting the AI.';
    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.end();
  }
});

module.exports = router;
