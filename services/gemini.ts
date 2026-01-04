//services/gemini.ts

// 1. get the key from secret pocket (.env)
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

// 2. call the API
export async function askGemini(question: string) {
    // 2. Destiantion address
    const destination = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`;
    try {
        // 3. Sending the request
        const response = await fetch(destination, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: question
                            }
                        ]
                    }
                ]
            })
        });
        // 4. Getting the answer back
        const data = await response.json();
        // 5. Finding the text in the response
        // Google sends a big "Object", we need to go deep inside it:
        // candidates -> first one [0] -> content -> parts -> first one [0] -> text
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return aiText || "I received an empty response from Gemini."

    } catch (error) {
        console.error("Error calling Gemini:", error);
        return "Something went wrong with the connection."
    }
}