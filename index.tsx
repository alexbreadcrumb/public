import { GoogleGenAI, Type } from "@google/genai";

declare global {
    interface Window {
        fetchArtistTriviaForToday: (artistName: string) => Promise<string | null>;
    }
}

async function fetchArtistTriviaForToday(artistName: string): Promise<string | null> {
    const today = new Date();
    // Use local date parts instead of UTC to align with the user's "today"
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    const day = today.getDate();
    const cacheKey = `puzzletunesTrivia-${artistName.replace(/\s+/g, '-')}-${year}-${month + 1}-${day}`;

    // 1. Check for cached data first
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            console.log(`Serving trivia for '${artistName}' from cache.`);
            return cachedData;
        }
    } catch (error) {
        console.error("Error reading trivia from cache:", error);
    }

    // 2. If no cache, fetch from Gemini using a structured JSON approach
    console.log(`Fetching structured trivia for '${artistName}' from Gemini API.`);
    try {
        if (!process.env.API_KEY) {
            console.error("Gemini API key not found in environment variables.");
            return null;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const lang = localStorage.getItem('puzzletunesLanguage') || 'es';
        const monthName = today.toLocaleString(lang, { month: 'long' });

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                event_type: { type: Type.STRING, description: "Type of event (e.g., Birthday, Release, Anniversary) or 'NO_EVENT'." },
                description: { type: Type.STRING, description: "A concise description of the event (e.g., 'the singer Marc Anthony was born')." },
                year: { type: Type.INTEGER, description: "The year the event occurred." }
            },
            required: ['event_type', 'description', 'year']
        };

        let prompt = '';
        let systemInstruction = '';
        let sentenceConstructor: (data: { year: number; description: string }) => string;

        switch (lang) {
            case 'pt':
                prompt = `Para o artista "${artistName}", encontre um evento notável (aniversário, lançamento de álbum, etc.) que ocorreu na data ${day} de ${monthName} de qualquer ano. Forneça o tipo de evento, ano e uma descrição.`;
                systemInstruction = "Você é um assistente de enciclopédia musical que fornece dados estruturados.";
                sentenceConstructor = (data) => `Neste dia, em ${data.year}, ${data.description}.`;
                break;
            case 'fr':
                // FIX: Corrected typo in the prompt from 'descrição' to 'description'.
                prompt = `Pour l'artiste "${artistName}", trouvez un événement notable (anniversaire, sortie d'album, etc.) qui s'est produit à la date du ${day} ${monthName} de n'importe quelle année. Fournissez le type d'événement, l'année et une description.`;
                systemInstruction = "Vous êtes un assistant d'encyclopédie musicale qui fournit des données structurées.";
                sentenceConstructor = (data) => `En ce jour, en ${data.year}, ${data.description}.`;
                break;
            case 'en':
                prompt = `For the artist "${artistName}", find a notable event (birthday, album release, etc.) that occurred on the date ${monthName} ${day} of any year. Provide the event type, year, and a description.`;
                systemInstruction = "You are a musical encyclopedia assistant providing structured data.";
                sentenceConstructor = (data) => `On this day, in ${data.year}, ${data.description}.`;
                break;
            case 'es':
            default:
                prompt = `Para el artista "${artistName}", busca un evento notable (su cumpleaños, lanzamiento de álbum o canción, aniversario de fallecimiento, primer concierto, rol en una película, etc.) que ocurrió en la fecha ${day} de ${monthName} de cualquier año. Proporciona el tipo de evento, el año y una descripción concisa.`;
                systemInstruction = "Eres un asistente de enciclopedia musical que proporciona datos estructurados.";
                sentenceConstructor = (data) => `Un día como hoy, en ${data.year}, ${data.description}.`;
                break;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                systemInstruction: systemInstruction,
                temperature: 0,
            }
        });

        const jsonText = response.text.trim();
        console.log(`Gemini JSON response for '${artistName}':`, jsonText);

        let triviaData;
        try {
            triviaData = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse JSON response from Gemini:", e, jsonText);
            return null;
        }

        if (!triviaData || triviaData.event_type === 'NO_EVENT' || !triviaData.description || !triviaData.year) {
            console.log("Response deemed invalid (NO_EVENT or missing data).");
            return null;
        }

        const finalTriviaText = sentenceConstructor(triviaData);
        
        try {
            localStorage.setItem(cacheKey, finalTriviaText);
        } catch (error) {
            console.error("Error saving valid trivia to cache:", error);
        }
        
        return finalTriviaText;

    } catch (error) {
        console.error(`Error fetching trivia for '${artistName}' from Gemini:`, error);
        return null;
    }
}

window.fetchArtistTriviaForToday = fetchArtistTriviaForToday;
