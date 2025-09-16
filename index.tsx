import { GoogleGenAI, Type } from "@google/genai";

declare global {
    interface Window {
        fetchOnThisDayAlbumsFromGemini: () => Promise<{ artistName: string; albumName: string; }[]>;
    }
}

async function fetchOnThisDayAlbumsFromGemini(): Promise<{ artistName: string; albumName: string; }[]> {
    try {
        if (!process.env.API_KEY) {
            console.error("Gemini API key not found in environment variables.");
            return [];
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const today = new Date();
        const lang = localStorage.getItem('puzzletunesLanguage') || 'es';
        const month = today.toLocaleString(lang, { month: 'long', timeZone: 'UTC' });
        const day = today.getUTCDate();
        
        const prompt = `Give me a list of 5 notable and popular music albums released on ${month} ${day}.`;

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
            return parsed.albums;
        }

        return [];

    } catch (error) {
        console.error("Error fetching 'On This Day' albums from Gemini:", error);
        return [];
    }
}

window.fetchOnThisDayAlbumsFromGemini = fetchOnThisDayAlbumsFromGemini;
