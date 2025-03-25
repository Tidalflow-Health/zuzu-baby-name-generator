// Vercel API endpoint for generating baby names using OpenAI

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Generate baby names using OpenAI
 * 
 * @param {object} req - The request object
 * @param {object} res - The response object
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for OpenAI API key
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { lastName, gender, count = 20, searchQuery = '', excludeNames = [] } = req.body;

    // Build the prompt for OpenAI
    const prompt = generatePrompt({ lastName, gender, searchQuery, excludeNames });
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a baby name generator assistant. Generate creative, meaningful baby names with accurate origins and meanings.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return res.status(response.status).json({ 
        error: 'Error from OpenAI API', 
        details: errorData 
      });
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    
    // Parse the response into structured name data
    const names = parseOpenAIResponse(text, lastName, gender);
    
    // Return the generated names
    return res.status(200).json({ names });
  } catch (error) {
    console.error('Error generating names:', error);
    return res.status(500).json({ error: 'Failed to generate names', details: error.message });
  }
}

/**
 * Generate the prompt for OpenAI
 */
function generatePrompt({ lastName, gender, searchQuery, excludeNames }) {
  let prompt = 'Generate a list of 20 unique baby names';
  
  // Add gender specification
  if (gender && gender !== 'any') {
    prompt += ` for ${gender}s`;
  }
  
  // Add last name context
  if (lastName) {
    prompt += ` with the last name "${lastName}"`;
  }
  
  // Add search query context
  if (searchQuery) {
    prompt += ` that match this criteria: ${searchQuery}`;
  }
  
  // Add names to exclude
  if (excludeNames && excludeNames.length > 0) {
    const excludeList = excludeNames.slice(0, 30).join(', '); // Limit to 30 names for prompt length
    prompt += `. Exclude these names: ${excludeList}`;
  }
  
  // Add format instructions
  prompt += `. For each name, include: first name, meaning, origin, and gender (boy/girl/unisex). Return the results in JSON format as an array of objects with firstName, meaning, origin, and gender fields. Example: [{"firstName": "Emma", "meaning": "Universal", "origin": "Germanic", "gender": "girl"}, ...]`;
  
  return prompt;
}

/**
 * Parse the OpenAI response into structured name data
 */
function parseOpenAIResponse(text, lastName, gender) {
  try {
    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('Could not find JSON array in response:', text);
      return [];
    }
    
    const jsonString = jsonMatch[0];
    const names = JSON.parse(jsonString);
    
    // Validate and normalize the names
    return names.map(name => ({
      firstName: name.firstName || '',
      lastName: lastName || undefined,
      meaning: name.meaning || 'Unknown meaning',
      origin: name.origin || 'Unknown origin',
      gender: name.gender || (gender !== 'any' ? gender : 'unisex'),
    })).filter(name => name.firstName.trim() !== '');
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    console.log('Raw response:', text);
    return [];
  }
} 