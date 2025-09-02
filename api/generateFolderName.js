import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Initialize Google Generative AI
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      console.error('Gemini API key not configured.');
      res.status(503).json({ error: 'Service Unavailable: AI service is not configured.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const { images, locale } = req.body;

    // Validate input
    if (!Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: 'Bad Request: images array is required.' });
      return;
    }

    // Prepare image parts for AI processing
    const imageParts = images.map((img) => ({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType,
      },
    }));

    // Create language-specific instruction
    const languageInstruction = locale === 'ja'
      ? '日本語で、アンダースコア(_)を使った3〜5単語程度の短いフォルダ名を提案してください。例: 夏休み_家族旅行, 公園でのピクニック'
      : 'Suggest a short, 3-5 word folder name using underscores. Example: Summer_Vacation_Trip, Picnic_in_the_Park';

    const prompt = `Based on these images, what's a good name for this photo folder? ${languageInstruction}`;
    
    // Generate content using Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([prompt, ...imageParts]);
    
    // Process and clean the response
    const text = result.response.text()
      .trim()
      .replace(/ /g, '_')
      .replace(/[^\w\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff_-]/g, '');

    res.status(200).json({ suggestion: text });
  } catch (error) {
    console.error('Error in generateFolderName function:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}