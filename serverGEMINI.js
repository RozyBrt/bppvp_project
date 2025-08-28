// server.js
require('dotenv').config(); // Pastikan ini ada di baris paling atas
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ambil API Key dari .env
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ Kesalahan: API key tidak ditemukan. Harap isi GEMINI_API_KEY di file .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- PENAMBAHAN DI SINI ---
// Route dasar untuk mengecek apakah server berjalan
app.get('/', (req, res) => {
    res.send('✅ Server Hati Tenang sedang berjalan!');
});


// Endpoint untuk menganalisis tingkat stres
app.post('/analyze-stress', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    const prompt = `
        Analisis sentimen dari teks berikut, yang merupakan bagian dari percakapan curhat.
        Berikan respons HANYA dalam format JSON yang valid.
        JSON harus memiliki satu kunci: "stressChange", dengan nilai angka antara -20 hingga +40.
        - Gunakan nilai positif jika teks menunjukkan stres, kecemasan, atau kesedihan (misal: +30 untuk "aku putus asa").
        - Gunakan nilai negatif jika teks menunjukkan kelegaan, kebahagiaan, atau sentimen positif (misal: -15 untuk "aku merasa lebih baik sekarang").
        - Gunakan nilai mendekati 0 untuk teks netral.
        Jangan tambahkan penjelasan apa pun di luar JSON.

        Teks Pengguna: "${message}"
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonString);

        console.log('[AI Analyst] Menganalisis:', message, '-> Hasil:', data);
        res.json(data);
    } catch (error) {
        console.error('Error saat memanggil Gemini API (Stress Analysis):', error);
        res.status(500).json({ error: 'Gagal menganalisis stres' });
    }
});

// Endpoint untuk menghasilkan balasan percakapan
app.post('/generate-response', async (req, res) => {
    const { chatHistory, currentStressScore } = req.body;

    if (!chatHistory || chatHistory.length === 0) {
        return res.status(400).json({ error: 'Riwayat percakapan tidak boleh kosong' });
    }

    const formattedHistory = chatHistory.map(item => `${item.role}: ${item.parts}`).join('\n');

    const prompt = `
        Anda adalah "Teman Cerita AI", sebuah chatbot pendengar yang sangat empatik, hangat, dan suportif. 
        Tugas Anda adalah untuk mendengarkan, memvalidasi perasaan pengguna, dan mengajukan pertanyaan reflektif. 
        JANGAN memberikan nasihat kecuali diminta secara eksplisit. JANGAN menggunakan daftar bernomor atau poin-poin. Buat respons Anda singkat dan terasa seperti percakapan alami.

        Konteks: Tingkat stres pengguna saat ini adalah ${currentStressScore} dari 100.
        - Jika stres di bawah 40, bersikaplah suportif dan ingin tahu.
        - Jika stres antara 40 dan 75, tingkatkan empati dan validasi perasaan mereka.
        - Jika stres di atas 75, respons Anda HARUS dengan lembut mengarahkan mereka untuk mempertimbangkan bantuan profesional, tanpa memaksa.

        Riwayat Percakapan:
        ${formattedHistory}

        Tugas: Hasilkan balasan untuk pesan terakhir dari "user".
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const type = currentStressScore >= 75 ? 'escalation' : 'standard';

        console.log('[AI Conversation] Merespons riwayat. Hasil:', { type, message: responseText });
        res.json({ type, message: responseText });

    } catch (error) {
        console.error('Error saat memanggil Gemini API (Conversational Response):', error);
        res.status(500).json({ error: 'Gagal menghasilkan balasan' });
    }
});


app.listen(port, () => {
    console.log(`✅ Server berjalan di http://localhost:${port}`);
});
