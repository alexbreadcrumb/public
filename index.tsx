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

        let prompt = `Is there a notable musical event (album/single release, famous concert, significant news) for the artist "${artistName}" that happened on ${monthName} ${day}? Give a concise, single-sentence summary starting with "On this day...". If no notable event is found, reply with only the exact text: NO_EVENT`;
        switch (lang) {
            case 'es':
                prompt = `¿Hubo algún evento musical notable (lanzamiento de álbum/sencillo, concierto famoso, noticia significativa) para el artista "${artistName}" que haya ocurrido un ${day} de ${monthName}? Dame un resumen conciso en una sola frase que comience con "Un día como hoy...". Si no encuentras ningún evento notable, responde únicamente con el texto exacto: NO_EVENT`;
                break;
            case 'pt':
                prompt = `Houve algum evento musical notável (lançamento de álbum/single, show famoso, notícia significativa) para o artista "${artistName}" que aconteceu em ${day} de ${monthName}? Dê-me um resumo conciso de uma única frase começando com "Neste dia...". Se nenhum evento notável for encontrado, responda apenas com o texto exato: NO_EVENT`;
                break;
            case 'fr':
                prompt = `Y a-t-il eu un événement musical notable (sortie d'album/single, concert célèbre, nouvelle importante) pour l'artiste "${artistName}" qui s'est produit le ${day} ${monthName} ? Donnez-moi un résumé concis en une seule phrase commençant par "En ce jour...". Si aucun événement notable n'est trouvé, répondez uniquement avec le texte exact : NO_EVENT`;
                break;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const triviaText = response.text.trim();

        // 3. Save the new data to cache
        try {
            localStorage.setItem(cacheKey, triviaText);
        } catch (error) {
            console.error("Error saving trivia to cache:", error);
        }
        
        if (triviaText === NO_EVENT_FLAG || triviaText.length < 10) { // Also filter out very short/empty responses
            return null;
        }

        return triviaText;

    } catch (error) {
        console.error(`Error fetching trivia for '${artistName}' from Gemini:`, error);
        return null;
    }
}

window.fetchArtistTriviaForToday = fetchArtistTriviaForToday;
