const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert content strategist specializing in tribal alignment content. Generate a complete list of Instagram Reels video topics that attract only people who are mutually aligned with the creator's lived experience, identity, personality, beliefs, skills, past journey, and core transformations. Based only on the interview data provided, produce the fullest possible list of video topics that signal tribal alignment. These topics must repel the wrong audience and attract only people who share similar worldviews, desires, lifestyles, ambitions, fears, backgrounds, or goals.

Output as JSON array named video_topics where each item has:
- topic_title: Clear hook that signals alignment
- why_it_attracts_their_tribe: One sentence explaining the alignment mechanism
- what_story_or_angle_to_use: Specific angle based on the interview data

Generate as many distinct topics as possible by extracting every trait, belief, story, struggle, win, lesson, identity marker, and transformation from the interview data.`;

router.post('/generate', async (req, res) => {
  const { interviewData } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured. Please set it in your .env file.' });
  }

  if (!interviewData || typeof interviewData !== 'object') {
    return res.status(400).json({ error: 'Invalid request: interviewData object is required.' });
  }

  // Convert the structured interview data to a readable text block
  const formattedData = Object.entries(interviewData)
    .filter(([, value]) => value && String(value).trim().length > 0)
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
      return `${label}:\n${value}`;
    })
    .join('\n\n');

  if (!formattedData.trim()) {
    return res.status(400).json({ error: 'Please fill in at least one field in the interview form.' });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is my interview data:\n\n${formattedData}`,
        },
      ],
    });

    const rawText = response.content[0].text;

    // Extract JSON from the response
    let topics = null;
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Handle both { video_topics: [...] } and plain array
        topics = Array.isArray(parsed) ? parsed : parsed.video_topics || parsed;
      } else {
        // Try parsing as object with video_topics key
        const objMatch = rawText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const parsed = JSON.parse(objMatch[0]);
          topics = parsed.video_topics || (Array.isArray(parsed) ? parsed : [parsed]);
        }
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
    }

    res.json({
      success: true,
      rawText,
      topics: topics || [],
      parseError: topics === null ? 'Could not parse structured JSON from response. Raw text returned.' : null,
    });
  } catch (err) {
    console.error('Reels Generator error:', err);
    const errorMsg = err.status === 401
      ? 'Invalid API key. Please check your ANTHROPIC_API_KEY.'
      : err.message || 'An error occurred while contacting the AI.';
    res.status(500).json({ error: errorMsg });
  }
});

module.exports = router;
