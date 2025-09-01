// server.js
require('dotenv').config();
const express = require('express');
const Groq = require('groq-sdk'); // Library baru
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ambil API Key dari .env untuk Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
    console.error("❌ Kesalahan: GROQ_API_KEY tidak ditemukan di file .env");
    process.exit(1);
}

// Inisialisasi klien Groq
const groq = new Groq({ apiKey: GROQ_API_KEY });

// --- LOGIKA FALLBACK ---
const fallbackResponses = [
    "Aku mengerti.", "Terima kasih sudah berbagi.", "Itu pasti terasa berat ya.", "Aku di sini mendengarkan.", "Perasaanmu itu valid."
];

// Route dasar
app.get('/', (req, res) => {
    res.send('Server grock ✅');
});

// Endpoint untuk menganalisis tingkat stres
app.post('/analyze-stress', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong' });

    try {
        console.log('[Attempting] Groq Analysis...');
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'Anda adalah AI analisis sentimen. Analisis teks pengguna dan berikan respons HANYA dalam format JSON yang valid. JSON harus memiliki satu kunci: "stressChange", dengan nilai angka antara -20 (sangat positif/lega) dan +40 (sangat stres/negatif). Jangan tambahkan teks atau penjelasan lain.'
                },
                {
                    role: 'user',
                    content: message,
                },
            ],
            model: 'llama3-8b-8192', // Model yang sangat cepat di Groq
            response_format: { type: 'json_object' }, // Memaksa output menjadi JSON
        });

        const responseContent = chatCompletion.choices[0].message.content;
        const data = JSON.parse(responseContent);

        // Pastikan nilai stressChange selalu berupa angka (integer).
        const stressChange = parseInt(data.stressChange, 10);

        // Validasi jika hasilnya bukan angka
        if (isNaN(stressChange)) {
            console.error("❌ Groq mengembalikan 'stressChange' yang bukan angka:", data.stressChange);
            // Kirim perubahan netral agar tidak menyebabkan error di frontend.
            return res.json({ stressChange: 1 });
        }

        const validatedData = { stressChange: stressChange };
        console.log('✅ [Groq Analyst] Sukses (Validated):', validatedData);
        return res.json(validatedData);

    } catch (groqError) {
        console.warn("⚠️ [Groq Failed] Gagal:", groqError.message.substring(0, 100));
        console.log('[Fallback Mode] Mengirim analisis stres manual.');
        return res.json({ stressChange: 1 });
    }
});

// Endpoint untuk menghasilkan balasan percakapan
app.post('/generate-response', async (req, res) => {
    const { chatHistory, currentStressScore } = req.body;
    if (!chatHistory || chatHistory.length === 0) return res.status(400).json({ error: 'Riwayat percakapan tidak boleh kosong' });

    // Mengubah format histori chat agar sesuai dengan format Groq
    const messages = [
        {
            role: 'system',
            content: `Anda adalah "Teman Cerita AI", chatbot pendengar yang sangat empatik, hangat, dan suportif. Tugas Anda adalah untuk mendengarkan dan memvalidasi perasaan pengguna. JANGAN memberikan nasihat. Buat respons Anda singkat dan alami. Konteks stres pengguna saat ini adalah ${currentStressScore}/100.`
        },
        ...chatHistory.map(item => ({
            role: item.role === 'model' ? 'assistant' : 'user',
            content: item.parts
        }))
    ];

    try {
        console.log('[Attempting] Groq Conversation...');
        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: 'llama3-8b-8192',
        });

        const responseText = chatCompletion.choices[0].message.content;
        const type = currentStressScore >= 75 ? 'escalation' : 'standard';
        console.log('✅ [Groq Conversation] Sukses.');
        return res.json({ type, message: responseText });

    } catch (groqError) {
        console.warn("⚠️ [Groq Failed] Gagal:", groqError.message.substring(0, 100));
        const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        console.log('[Fallback Mode] Mengirim balasan percakapan manual.');
        return res.json({ type: 'standard', message: randomResponse });
    }
});

app.listen(port, () => {
    console.log(`✅ Server berjalan di http://localhost:${port}`);
});
