const { put, list } = require('@vercel/blob');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = async function handler(req, res) {
  const { name, type } = req.query;

  if (!name || !type) {
    return res.status(400).json({ error: 'Missing name or type query param' });
  }

  const blobKey = `recipe-${slugify(name)}-${type}.json`;

  // Check blob cache
  try {
    const { blobs } = await list({ prefix: 'recipe-' });
    const cached = blobs.find(b => b.pathname === blobKey);
    if (cached) {
      const response = await fetch(cached.downloadUrl);
      const data = await response.json();
      res.setHeader('Cache-Control', 'public, s-maxage=2592000');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(data);
    }
  } catch (e) {
    console.log('Recipe blob check failed:', e.message);
  }

  // Generate recipe details
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Generate a detailed recipe for "${name}" (${type}). Return ONLY valid JSON with no markdown, no code blocks, no explanation.

Return this exact structure:
{
  "ingredients": ["1 cup ingredient", "2 tbsp ingredient"],
  "steps": ["Step instruction.", "Step instruction."],
  "tip": "One practical cooking or prep tip."
}

Requirements:
- 5–6 ingredients with exact measurements
- 4–5 clear, concise cooking steps (one sentence each)
- One genuinely useful tip (substitution, technique, or storage)
- Keep it healthy, high-protein, weight-loss friendly`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text;
    const jsonText = text.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
    const data = JSON.parse(jsonText);

    // Cache in blob (recipes don't expire — they're evergreen)
    await put(blobKey, JSON.stringify(data), { access: 'private', addRandomSuffix: false });

    res.setHeader('Cache-Control', 'public, s-maxage=2592000');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Recipe generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate recipe', detail: err.message });
  }
}
