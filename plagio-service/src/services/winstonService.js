class WinstonService {
    /**
     * Obtiene la clave de API del entorno y valida que esté configurada.
     */
    getApiKey() {
        const apiKey = process.env.WINSTON_API_KEY;
        if (!apiKey) {
            throw new Error('La variable de entorno WINSTON_API_KEY no está configurada.');
        }
        return apiKey;
    }

    /**
     * Envía texto a la API de plagio de Winston AI.
     * @param {string} text - El texto a analizar.
     * @param {string} language - Idioma del texto (por defecto 'auto').
     * @param {string} country - Contexto de país (por defecto 'us').
     */
    async checkPlagiarism(text, language = 'auto', country = 'us') {
        const apiKey = this.getApiKey();
        console.log('Enviando solicitud de plagio a Winston AI...');
        
        const response = await fetch('https://api.gowinston.ai/v2/plagiarism', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                language,
                country
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`La API de Winston AI retornó un error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        console.log('✅ Solicitud de plagio procesada exitosamente por Winston AI.');
        return data;
    }

    /**
     * Envía texto a la API de detección de IA de Winston AI.
     * @param {string} text - El texto a analizar.
     */
    async detectAIContent(text) {
        const apiKey = this.getApiKey();
        console.log('Enviando solicitud de detección de IA a Winston AI...');

        const response = await fetch('https://api.gowinston.ai/v2/ai-content-detection', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`La API de Winston AI retornó un error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        console.log('✅ Solicitud de detección de IA procesada exitosamente por Winston AI.');
        return data;
    }
}

module.exports = new WinstonService();
