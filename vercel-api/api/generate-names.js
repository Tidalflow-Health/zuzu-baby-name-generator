// OpenAI API handler for generating baby names
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Generate baby names using OpenAI
 * 
 * @param {object} req - Request object
 * @param {object} res - Response object
 */
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for OpenAI API key
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Parse request body or query parameters
    const body = req.body || {};
    const {
      lastName = '',
      gender = 'any',
      count = 20,
      searchQuery = '',
      excludeNames = []
    } = body;

    console.log('Generating names with:', {
      lastName,
      gender,
      searchQuery,
      count,
      excludeNamesCount: excludeNames?.length || 0
    });

    // Construct the prompt for OpenAI
    let prompt = `Generate ${count} unique baby names`;
    
    if (gender && gender !== 'any') {
      prompt += ` for ${gender}s`;
    }
    
    if (searchQuery) {
      prompt += ` matching the search criteria: "${searchQuery}"`;
    }
    
    if (lastName) {
      prompt += ` with the last name ${lastName}`;
    }

    if (excludeNames && excludeNames.length > 0) {
      prompt += `. Don't include these names: ${excludeNames.join(', ')}`;
    }

    prompt += `. For each name, include the origin, meaning, and gender (boy, girl, or unisex).
    Format the results as a JSON array of objects with these properties: firstName, lastName, meaning, origin, gender.
    Example:
    [
      {
        "firstName": "Sophia",
        "lastName": "${lastName || ''}",
        "meaning": "Wisdom",
        "origin": "Greek",
        "gender": "girl"
      }
    ]`;

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
            content: 'You are a helpful assistant that generates baby names in JSON format. Only respond with valid JSON.'
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
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({ 
        error: `OpenAI API error: ${response.status} - ${response.statusText}` 
      });
    }

    const data = await response.json();
    console.log('OpenAI response received');

    // Extract JSON from the response
    let generatedNames = [];
    try {
      const contentText = data.choices[0].message.content.trim();
      // Try to parse JSON directly
      try {
        generatedNames = JSON.parse(contentText);
      } catch (e) {
        // If direct parsing fails, try to extract JSON from the string
        const jsonMatch = contentText.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
          generatedNames = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not extract valid JSON from the response');
        }
      }

      // Validate the response format
      if (!Array.isArray(generatedNames)) {
        throw new Error('Response is not an array');
      }

      // Filter out any names in the exclude list
      if (excludeNames && excludeNames.length > 0) {
        generatedNames = generatedNames.filter(name => 
          !excludeNames.includes(name.firstName));
      }

      console.log(`Successfully generated ${generatedNames.length} names`);
      
      // Return the names
      return res.status(200).json({ names: generatedNames });
    } catch (error) {
      console.error('Error parsing OpenAI response:', error, data.choices[0].message.content);
      return res.status(500).json({ 
        error: 'Failed to parse names from OpenAI response',
        rawResponse: data.choices[0].message.content
      });
    }
  } catch (error) {
    console.error('Error in name generation:', error);
    return res.status(500).json({ 
      error: `Error generating names: ${error.message}` 
    });
  }
}; 