# Configure the Diogenes key

1. Create an API key in the [OpenAI dashboard](https://platform.openai.com/api-keys).
2. In the Vercel project, open **Settings → Environment Variables**. Add the key as **DIOGENES_OPENAI_API_KEY** for **Production** and **Preview**, then redeploy. Verify by opening **/api/diogenes?health=1** on the deployed site. The response should contain "configured": true and the active model name.
