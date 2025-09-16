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

    // 1. Check for cached data first (including negative cache)
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            console.log(`Serving trivia for '${artistName}' from cache.`);
            return cachedData === 'NO_EVENT' ? null : cachedData;
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
                prompt = `Qual é o evento musical mais notável para o artista "${artistName}" na data de ${day} de ${monthName}? Considere aniversários ou lançamentos. Responda com dados estruturados.`;
                systemInstruction = "Você é um assistente de enciclopédia musical que fornece dados estruturados.";
                sentenceConstructor = (data) => `Neste dia, em ${data.year}, ${data.description}.`;
                break;
            case 'fr':
                prompt = `Quel est l'événement musical le plus notable pour l'artiste "${artistName}" à la date du ${day} ${monthName} ? Considérez les anniversaires ou les sorties. Répondez avec des données structurées.`;
                systemInstruction = "Vous êtes un assistant d'encyclopédie musicale qui fournit des données structurées.";
                sentenceConstructor = (data) => `En ce jour, en ${data.year}, ${data.description}.`;
                break;
            case 'en':
                prompt = `What is the most notable musical event for the artist "${artistName}" on the date ${monthName} ${day}? Consider birthdays or releases. Respond with structured data.`;
                systemInstruction = "You are a musical encyclopedia assistant providing structured data.";
                sentenceConstructor = (data) => `On this day, in ${data.year}, ${data.description}.`;
                break;
            case 'es':
            default:
                prompt = `¿Cuál es la efeméride musical más notable para el artista "${artistName}" en la fecha ${day} de ${monthName}? Considera cumpleaños o lanzamientos. Responde con los datos estructurados.`;
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
        
        if (!triviaData || !triviaData.event_type || !triviaData.description) {
            console.log("Response is malformed or missing key data.", triviaData);
            return null; 
        }

        if (triviaData.event_type === 'NO_EVENT') {
            console.log(`Gemini confirmed NO_EVENT for '${artistName}' today.`);
            try {
                localStorage.setItem(cacheKey, 'NO_EVENT');
            } catch (error) {
                console.error("Error saving NO_EVENT to cache:", error);
            }
            return null;
        }
        
        if (!triviaData.year || triviaData.year === 0) {
            console.log(`Response for '${artistName}' is missing a valid year. Discarding.`, triviaData);
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