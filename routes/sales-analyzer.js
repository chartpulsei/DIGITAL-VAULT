const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert in sales call analysis, buyer psychology, objection pattern recognition, and content strategy for high ticket education offers. When the user provides sales call transcripts, your job is to: 1. Read every line carefully. 2. Extract every explicit objection, hidden objection, hesitation, limiting belief, trust concern, timeline objection, self image objection, money objection, saturation objection, skill objection, and framework confusion. 3. Categorize these objections into themes that represent the barriers preventing high intent buyers from closing. 4. Convert every objection into a video topic engineered to attract only the ideal client profile: people with money, urgency, self belief, operator mindset, and willingness to implement. 5. For each objection, create: a content hook, a talking point outline, a belief shift, and a call to action that increases close rate. 6. Never soften, water down, or generalize objections. Be precise and psychological, using the exact words buyers use. 7. Output everything in an organized JSON structure with: { "objection": "", "category": "", "root_cause": "", "video_topic": "", "hook": "", "talking_points": [], "belief_shift": "", "cta": "" }. 8. Do not fabricate objections. Only use what appears in the transcripts.`;

router.post('/analyze', async (req, res) => {
  const { transcript } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured. Please set it in your .env file.' });
  }

  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid request: transcript text is required.' });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here are the sales call transcripts to analyze:\n\n${transcript}`,
        },
      ],
    });

    const rawText = response.content[0].text;

    // Extract JSON from the response — it may be wrapped in markdown code blocks
    let parsed = null;
    try {
      // Try to find a JSON array in the response
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Maybe it's a single object
        const objMatch = rawText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const single = JSON.parse(objMatch[0]);
          parsed = Array.isArray(single) ? single : [single];
        }
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
    }

    res.json({
      success: true,
      rawText,
      objections: parsed || [],
      parseError: parsed === null ? 'Could not parse structured JSON from response. Raw text returned.' : null,
    });
  } catch (err) {
    console.error('Sales Analyzer error:', err);
    const errorMsg = err.status === 401
      ? 'Invalid API key. Please check your ANTHROPIC_API_KEY.'
      : err.message || 'An error occurred while contacting the AI.';
    res.status(500).json({ error: errorMsg });
  }
});

module.exports = router;
