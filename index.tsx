import { GoogleGenAI, Type } from "@google/genai";

declare global {
    interface Window {
        fetchOnThisDayAlbumsFromGemini: () => Promise<{ artistName: string; albumName: string; }[]>;
    }
}

async function fetchOnThisDayAlbumsFromGemini(): Promise<{ artistName: string; albumName: string; }[]> {
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth(); // 0-indexed
    const day = today.getUTCDate();
    const cacheKey = `puzzletunesOnThisDay-${year}-${month + 1}-${day}`;

    // 1. Check for cached data first
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            console.log("Serving 'On This Day' from cache.");
            return JSON.parse(cachedData);
        }
    } catch (error) {
        console.error("Error reading from cache:", error);
    }

    // 2. If no cache, fetch from Gemini
    console.log("Fetching 'On This Day' from Gemini API.");
    try {
        if (!process.env.API_KEY) {
            console.error("Gemini API key not found in environment variables.");
            return [];
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const lang = localStorage.getItem('puzzletunesLanguage') || 'es';
        const monthName = today.toLocaleString(lang, { month: 'long', timeZone: 'UTC' });
        
        const prompt = `Give me a list of 5 notable and popular music albums released on ${monthName} ${day}.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        albums: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    artistName: {
                                        type: Type.STRING,
                                        description: "The name of the artist or band."
                                    },
                                    albumName: {
                                        type: Type.STRING,
                                        description: "The name of the album."
                                    }
                                },
                                required: ["artistName", "albumName"]
                            }
                        }
                    },
                    required: ["albums"]
                },
            },
        });

        const jsonString = response.text.trim();
        const parsed = JSON.parse(jsonString);

        if (parsed && Array.isArray(parsed.albums)) {
            // 3. Save the new data to cache
            try {
                localStorage.setItem(cacheKey, JSON.stringify(parsed.albums));
            } catch (error) {
                console.error("Error saving to cache:", error);
            }
            return parsed.albums;
        }

        return [];

    } catch (error) {
        console.error("Error fetching 'On This Day' albums from Gemini:", error);
        return [];
    }
}

window.fetchOnThisDayAlbumsFromGemini = fetchOnThisDayAlbumsFromGemini;
