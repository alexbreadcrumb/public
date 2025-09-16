import { GoogleGenAI } from "@google/genai";

declare global {
    interface Window {
        fetchArtistTriviaForToday: (artistName: string) => Promise<string | null>;
    }
}

async function fetchArtistTriviaForToday(artistName: string): Promise<string | null> {
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth(); // 0-indexed
    const day = today.getUTCDate();
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
        const monthName = today.toLocaleString(lang, { month: 'long', timeZone: 'UTC' });

        let prompt = `Search music history for an important event for the artist "${artistName}" that occurred on the exact date ${monthName} ${day} of any year. It could be a release, a key concert, or a milestone. Respond with a single, concise sentence starting with "On this day...". If there is absolutely nothing, reply only with "NO_EVENT".`;
        let expectedPrefix = "On this day...";
        
        switch (lang) {
            case 'es':
                prompt = `Busca en la historia de la música un evento importante para el artista "${artistName}" que ocurriera exactamente en la fecha ${day} de ${monthName} de cualquier año. Puede ser un lanzamiento, un concierto clave o un hito. Responde con una sola frase concisa que empiece con "Un día como hoy...". Si no hay absolutamente nada, responde solo con "NO_EVENT".`;
                expectedPrefix = "Un día como hoy...";
                break;
            case 'pt':
                prompt = `Pesquise na história da música por um evento importante para o artista "${artistName}" que ocorreu na data exata de ${day} de ${monthName} de qualquer ano. Pode ser um lançamento, um show importante ou um marco. Responda com uma única frase concisa começando com "Neste dia...". Se não houver absolutamente nada, responda apenas com "NO_EVENT".`;
                expectedPrefix = "Neste dia...";
                break;
            case 'fr':
                prompt = `Recherchez dans l'histoire de la musique un événement important pour l'artiste "${artistName}" qui s'est produit à la date exacte du ${day} ${monthName} de n'importe quelle année. Il peut s'agir d'une sortie, d'un concert clé ou d'un jalon. Répondez par une seule phrase concise commençant par "En ce jour...". S'il n'y a absolument rien, répondez uniquement par "NO_EVENT".`;
                expectedPrefix = "En ce jour...";
                break;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const triviaText = response.text.trim();

        // 3. Validate the response BEFORE caching
        if (triviaText === NO_EVENT_FLAG || !triviaText.startsWith(expectedPrefix)) {
            // If the response is the "no event" flag, or if it doesn't start with our required phrase,
            // consider it invalid. Cache this negative result so we don't ask again today.
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
