const PROMPT = `Generate a 7-day healthy meal plan as a JSON object. Return ONLY valid JSON with no markdown, no code blocks, no explanation.

The JSON must follow this exact structure:
{
  "days": [
    {
      "day": "Monday",
      "calories": 1480,
      "meals": [
        {
          "type": "breakfast",
          "name": "Meal Name Here",
          "desc": "One sentence description highlighting flavor and nutrition.",
          "cals": 340,
          "protein": "22g",
          "prep": "5 min",
          "time": "5 min",
          "servings": 1,
          "ingredients": ["1 cup full-fat Greek yogurt", "½ cup fresh blueberries", "2 tbsp granola"],
          "steps": ["Step one instruction.", "Step two instruction.", "Step three instruction."],
          "tip": "One practical cooking or prep tip."
        }
      ]
    }
  ]
}

Requirements:
- All 7 days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- Exactly 4 meals per day in this order: breakfast, lunch, snack, dinner
- Total daily calories: 1400–1600 kcal
- High protein focus, whole foods, weight-loss friendly
- 4–5 ingredients per meal
- 3–4 cooking steps per meal (keep steps brief, one sentence each)
- One short practical tip per meal
- protein field format: "22g" (number + g)
- prep and time fields format: "5 min", "20 min", etc.
- Make every meal unique — no repeats across the week`;

module.exports = async function handler(req, res) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 12000,
      messages: [{ role: 'user', content: PROMPT }]
    });

    const text = message.content[0].text;
    const jsonText = text.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
    const data = JSON.parse(jsonText);

    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Meal plan generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate meal plan' });
  }
}
