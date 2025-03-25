# Deploying the Zuzu Name Generator AI API to Vercel

This README provides instructions for deploying the OpenAI integration for the Zuzu Baby Name Generator to Vercel.

## Requirements

- Vercel account
- OpenAI API key
- Node.js and npm installed on your local machine

## Setup Steps

1. **Install the Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Clone this repository**:
   ```bash
   git clone <your-repository-url>
   cd Zuzu\ Baby\ Name\ Generator
   ```

3. **Navigate to the Vercel API directory**:
   ```bash
   cd vercel-api
   ```

4. **Login to Vercel**:
   ```bash
   vercel login
   ```

5. **Add your OpenAI API key as a Vercel secret**:
   ```bash
   vercel secrets add openai-api-key your-openai-api-key
   ```

6. **Deploy to Vercel**:
   ```bash
   vercel
   ```

7. **Link to production**:
   ```bash
   vercel --prod
   ```

8. **Update your app configuration**:
   After deployment, update the `VERCEL_API_URL` constant in `utils/openai.ts` with your Vercel deployment URL.

## API Endpoint

### `POST /api/generate-names`

The API has one endpoint that accepts POST requests with the following parameters:

```json
{
  "lastName": "Smith",        // Optional
  "gender": "boy",            // "boy", "girl", or "any"
  "count": 20,                // Number of names to generate
  "searchQuery": "nature",    // Optional context for name generation
  "excludeNames": ["John"]    // Optional array of names to exclude
}
```

### Response format

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

## Activating AI Name Generation

To enable AI name generation in the app:

1. Deploy the Vercel API as described above
2. Update the `VERCEL_API_URL` constant in `utils/openai.ts`
3. Set `AI_NAME_GENERATION` to `true` in `utils/appConfig.ts`

## Testing

You can test the API by sending a request to your Vercel deployment URL:

```bash
curl -X POST https://your-vercel-deployment.vercel.app/api/generate-names \
  -H "Content-Type: application/json" \
  -d '{"lastName":"Smith","gender":"boy","searchQuery":"mythology inspired"}'
``` 