# Zuzu Baby Name Generator - Vercel API

This is the Vercel API for the Zuzu Baby Name Generator app. It provides an endpoint for generating baby names using OpenAI.

## Deployment Instructions

1. **Install Vercel CLI**:
   ```
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```
   vercel login
   ```

3. **Add your OpenAI API key as a secret**:
   ```
   vercel secrets add openai-api-key your-openai-api-key
   ```

4. **Deploy the API**:
   ```
   cd vercel-api
   vercel
   ```

5. **Update the app with your Vercel deployment URL**:
   - Edit the `utils/openai.ts` file in the Zuzu Baby Name Generator app
   - Update the `VERCEL_API_URL` constant with your deployment URL

## API Endpoints

### `POST /api/generate-names`

Generates baby names using OpenAI.

**Request Body**:

```json
{
  "lastName": "Smith",
  "gender": "boy",
  "count": 20,
  "searchQuery": "nature-inspired",
  "excludeNames": ["John", "Michael"]
}
```

**Response**:

```json
{
  "names": [
    {
      "firstName": "River",
      "lastName": "Smith",
      "meaning": "A flowing body of water",
      "origin": "English",
      "gender": "boy"
    },
    ...
  ]
}
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `405 Method Not Allowed`: Only POST requests are allowed
- `500 Internal Server Error`: Error generating names or OpenAI API key not configured 