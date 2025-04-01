// vercel-api/api/generate-names.js

const { OpenAI } = require('openai');

// Ensure you have OPENAI_API_KEY set in your Vercel Environment Variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Configuration ---
const AI_MODEL = 'gpt-3.5-turbo'; // Or another suitable model
const AI_TEMPERATURE = 0.7; // Slightly higher temperature for more creative results (0.5-0.8 range)
const MAX_TOKENS = 1200; // Reduced from 1500 to decrease timeout risk

module.exports = async (req, res) => {
  // Allow POST requests only for security
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    searchQuery = '',
    gender = 'any',
    lastName = '', // Optional: Can be used for context if desired
    count = 20, // Default count requested by frontend (updated default to 20)
    excludeNames = [] // Receive excludeNames from the request body
  } = req.body;

  console.log(
    `[generate-names] Received request: searchQuery="${searchQuery}", gender="${gender}", count=${count}, excluding ${excludeNames.length} names.`
  );

  // --- Construct the Optimized Prompt ---
  const systemPrompt = `You are an expert baby name generator. Your goal is to generate creative and relevant baby names based on user queries.
Follow these instructions precisely:
1. Return ONLY a valid JSON array of name objects. Do NOT add explanations or markdown.
2. The array MUST contain exactly ${count} distinct name objects unless impossible.
3. Each name object MUST have these fields: "firstName", "meaning", "origin", "gender" (value: "boy", "girl", or "unisex").
4. Generate unique and interesting names related to the user's query.
5. IMPORTANT: If you cannot generate ${count} names exactly matching the query, generate as many creative and relevant names as possible (up to ${count}) matching the gender preference and the requested JSON array format.
6. Every name MUST have a meaningful description and clear origin information.
7. DO NOT include any of the following first names in the response: ${excludeNames.join(', ') || 'None'}.`; // Add exclusion list

  const userPrompt = `Generate exactly ${count} unique baby names based on this request:
- Theme/Query: ${searchQuery || 'popular and unique'}
- Gender: ${gender === 'any' ? 'mix of boy, girl, and unisex' : gender}
${lastName ? `- Optional context (last name): ${lastName}` : ''}
${excludeNames.length > 0 ? `- Exclude these first names: ${excludeNames.join(', ')}` : ''} 

Return ONLY a JSON array containing ${count} name objects in this exact format:
[{"firstName": "Name1", "meaning": "Meaning1", "origin": "Origin1", "gender": "boy/girl/unisex"}, ...other ${count -1} name objects...]`;

  try {
    const startTime = Date.now();
    console.log(`[generate-names] Calling OpenAI API (Model: ${AI_MODEL}, Temp: ${AI_TEMPERATURE})...`);

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: AI_TEMPERATURE,
      max_tokens: MAX_TOKENS,
    });

    const duration = Date.now() - startTime;
    console.log(`[generate-names] OpenAI response received in ${duration}ms.`);

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      console.error('[generate-names] Error: OpenAI response content is empty.');
      return res
        .status(500)
        .json({ error: 'AI service returned an empty response.' });
    }

    // --- Robust JSON Parsing ---
    let parsedNames = [];
    try {
      // Sometimes the response might have leading/trailing whitespace or markdown ```json ... ```
      const cleanedResponse = rawResponse.trim().replace(/^```json\s*|\s*```$/g, '');
      const responseObj = JSON.parse(cleanedResponse);
      
      // Check the structure of the parsed response
      if (Array.isArray(responseObj)) {
        // Case 1: It's already an array (ideal case)
        parsedNames = responseObj;
      } else if (responseObj && typeof responseObj === 'object') {
        // Case 2: It's an object
        if (responseObj.names && Array.isArray(responseObj.names)) {
          // Subcase 2a: It has a 'names' property that is an array
          parsedNames = responseObj.names;
        } else if (responseObj.firstName && responseObj.meaning && responseObj.origin) {
          // Subcase 2b: It looks like a single name object - wrap it in an array
          console.log("[generate-names] Info: AI returned a single object, wrapping in array.");
          parsedNames = [responseObj];
        } else {
          // Subcase 2c: It's an object, but doesn't look like expected structure. Try finding an array within.
          const possibleArrays = Object.values(responseObj).filter(val => Array.isArray(val));
          if (possibleArrays.length > 0) {
             console.log("[generate-names] Info: Found an array within the response object.");
             parsedNames = possibleArrays[0]; 
          } else {
            throw new Error("AI response is an object, but not in the expected format (array, {names: [...]}, or single name object).");
          }
        }
      } else {
        // Case 3: It's not an array or a recognizable object
        throw new Error("AI response was not a valid JSON array or expected object structure.");
      }

      // Validate the structure and handle empty results
      if (!Array.isArray(parsedNames) || parsedNames.length === 0) {
        console.error('[generate-names] Error: Parsed data is empty or not an array after processing.');
        // Fall back to default names
        parsedNames = generateFallbackNames(gender, Math.min(count, 10));
      }

      // Ensure all names in the final array have the required fields (NO LAST NAME HERE)
      parsedNames = parsedNames.map(name => ({
        firstName: name.firstName || name.name || "Unknown",
        meaning: name.meaning || "A beautiful name",
        origin: name.origin || "Traditional",
        gender: name.gender || gender || "unisex"
      }));

    } catch (parseError) { // Removed ': any'
      console.error('[generate-names] Error processing or parsing OpenAI JSON response:', parseError);
      console.error('[generate-names] Raw Response Content:', rawResponse); // Log the problematic response
      
      // Fall back to default names rather than failing completely
      parsedNames = generateFallbackNames(gender, Math.min(count, 10));
    }

    console.log(`[generate-names] Successfully parsed ${parsedNames.length} names.`);
    
    // Return the names wrapped in a "names" object to match frontend expectations
    return res.status(200).json({ names: parsedNames });

  } catch (error) { // Removed ': any'
    // Log more details if it's an OpenAI API error
    if (error.constructor.name === 'APIError' || error.response) { // Check if it looks like an OpenAI error
      console.error('[generate-names] OpenAI API Error Details:', {
        status: error.status,
        message: error.message,
        code: error.code,
        type: error.type,
      });
    } else {
      // Log general errors
      console.error('[generate-names] General Error during API call or processing:', error);
    }
    
    // Return a friendly error response with fallback names
    const fallbackNames = generateFallbackNames(gender, Math.min(count, 5));
    return res.status(200).json({ 
      names: fallbackNames,
      warning: 'Generated fallback names due to API service error.',
      // Keep the original error message for debugging
      details: error.message 
    });
  }
};

// Fallback function to ensure we always return some names
function generateFallbackNames(gender = 'any', count = 5) {
  const boyNames = [
    { firstName: "Amir", meaning: "Prince, leader", origin: "Arabic", gender: "boy" },
    { firstName: "Noah", meaning: "Rest, comfort", origin: "Hebrew", gender: "boy" },
    { firstName: "Liam", meaning: "Strong-willed warrior", origin: "Irish", gender: "boy" },
    { firstName: "Kai", meaning: "Sea", origin: "Hawaiian", gender: "boy" },
    { firstName: "Omar", meaning: "Flourishing, long-lived", origin: "Arabic", gender: "boy" }
  ];
  
  const girlNames = [
    { firstName: "Layla", meaning: "Night, dark beauty", origin: "Arabic", gender: "girl" },
    { firstName: "Sophia", meaning: "Wisdom", origin: "Greek", gender: "girl" },
    { firstName: "Amara", meaning: "Eternal", origin: "African", gender: "girl" },
    { firstName: "Zara", meaning: "Princess", origin: "Arabic", gender: "girl" },
    { firstName: "Ava", meaning: "Life, living one", origin: "Latin", gender: "girl" }
  ];
  
  const unisexNames = [
    { firstName: "Jordan", meaning: "To flow down", origin: "Hebrew", gender: "unisex" },
    { firstName: "Riley", meaning: "Valiant", origin: "Irish", gender: "unisex" },
    { firstName: "Avery", meaning: "Ruler of the elves", origin: "English", gender: "unisex" },
    { firstName: "Quinn", meaning: "Counsel, wisdom", origin: "Irish", gender: "unisex" },
    { firstName: "Rowan", meaning: "Little red one", origin: "Irish", gender: "unisex" }
  ];

  if (gender === 'boy') return boyNames.slice(0, count);
  if (gender === 'girl') return girlNames.slice(0, count);
  if (gender === 'unisex') return unisexNames.slice(0, count);
  
  // For 'any' gender, mix them all
  const allNames = [...boyNames, ...girlNames, ...unisexNames];
  const shuffled = allNames.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}