
import { GoogleGenAI } from "@google/genai";

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
    const NO_EVENT_FLAG = "NO_EVENT";

    // 1. Check for cached data first
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            console.log(`Serving trivia for '${artistName}' from cache.`);
            return cachedData === NO_EVENT_FLAG ? null : cachedData;
        }
    } catch (error) {
        console.error("Error reading trivia from cache:", error);
    }

    // 2. If no cache, fetch from Gemini
    console.log(`Fetching trivia for '${artistName}' from Gemini API.`);
    try {
        if (!process.env.API_KEY) {
            console.error("Gemini API key not found in environment variables.");
            return null;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const lang = localStorage.getItem('puzzletunesLanguage') || 'es';
        // Get month name based on user's local timezone
        const monthName = today.toLocaleString(lang, { month: 'long' });

        let prompt = `Search music history for a notable event for the artist "${artistName}" (like their birthday, the release of an iconic album or single, a memorable concert, or a milestone) that occurred on the exact date ${monthName} ${day} of any year. Respond with a single, concise sentence starting with "On this day...". If you find no specific event, reply only with "NO_EVENT".`;
        let expectedPrefix = "On this day...";
        let systemInstruction = `You are a musical encyclopedia assistant. Your answers must be a single, concise sentence. You must strictly follow the output format requested in the prompt.`;
        
        switch (lang) {
            case 'es':
                prompt = `Busca en la historia de la música un hecho notable para el artista "${artistName}" (como su cumpleaños, el lanzamiento de un álbum o sencillo icónico, un concierto memorable, o un hito) que ocurriera exactamente en la fecha ${day} de ${monthName} de cualquier año. Responde con una sola frase concisa que empiece con "Un día como hoy...". Si no encuentras un evento específico, responde solo con "NO_EVENT".`;
                expectedPrefix = "Un día como hoy...";
                systemInstruction = "Eres un asistente de enciclopedia musical. Tus respuestas deben ser una única frase concisa. Debes seguir estrictamente el formato de salida solicitado en el prompt.";
                break;
            case 'pt':
                prompt = `Pesquise na história da música por um evento notável para o artista "${artistName}" (como o aniversário dele, o lançamento de um álbum ou single icônico, um show memorável ou um marco) que ocorreu na data exata de ${day} de ${monthName} de qualquer ano. Responda com una única frase concisa começando com "Neste dia...". Se você não encontrar nenhum evento específico, responda apenas com "NO_EVENT".`;
                expectedPrefix = "Neste dia...";
                systemInstruction = "Você é um assistente de enciclopédia musical. Suas respostas devem ser uma única frase concisa. Você deve seguir estritamente o formato de saída solicitado no prompt.";
                break;
            case 'fr':
                prompt = `Recherchez dans l'histoire de la musique un événement notable pour l'artiste "${artistName}" (comme son anniversaire, la sortie d'un album ou single emblématique, un concert mémorable ou une étape importante) qui s'est produit à la date exacte du ${day} ${monthName} de n'importe quelle année. Répondez par une seule phrase concise commençant par "En ce jour...". Si vous ne trouvez aucun événement spécifique, répondez uniquement par "NO_EVENT".`;
                expectedPrefix = "En ce jour...";
                systemInstruction = "Vous êtes un assistant d'encyclopédie musicale. Vos réponses doivent être une seule phrase concise. Vous devez suivre strictement le format de sortie demandé dans le prompt.";
                break;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        const triviaText = response.text.trim();

        // 3. Validate the response BEFORE caching
        const isInvalidResponse = triviaText === NO_EVENT_FLAG || 
                                  triviaText.length < 15 || // Too short to be a meaningful sentence
                                  !triviaText.toLowerCase().includes(artistName.split(' ')[0].toLowerCase()); // Must at least contain the artist's first name

        if (isInvalidResponse) {
            try {
                localStorage.setItem(cacheKey, NO_EVENT_FLAG);
            } catch (error) {
                console.error("Error saving NO_EVENT flag to cache:", error);
            }
            return null;
        }

        // 4. If response is valid, cache it and return it
        try {
            localStorage.setItem(cacheKey, triviaText);
        } catch (error) {
            console.error("Error saving valid trivia to cache:", error);
        }
        
        return triviaText;

    } catch (error) {
        console.error(`Error fetching trivia for '${artistName}' from Gemini:`, error);
        // Cache a failure to avoid repeated failed calls
        try {
            localStorage.setItem(cacheKey, NO_EVENT_FLAG);
        } catch (cacheError) {
            console.error("Error saving NO_EVENT flag to cache after a fetch error:", cacheError);
        }
        return null;
    }
}

window.fetchArtistTriviaForToday = fetchArtistTriviaForToday;
