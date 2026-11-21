// Server Express.js untuk Generator Drama & Iklan Video UMKM (ES Module - Kompatibel Railway & Express 5)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/gemini', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di server.' });
    }

    const { prompt, mode, imageBase64, imageMimeType } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt tidak boleh kosong.' });
    }

    if (mode === 'image') {
      const imageParts = [{ text: prompt }];
      if (imageBase64) {
        imageParts.push({
          inlineData: {
            mimeType: imageMimeType || 'image/png',
            data: imageBase64,
          },
        });
      }

      const imageModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
      let lastError = 'Gagal membuat gambar AI.';

      for (const modelName of imageModels) {
        const urlGambar = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(urlGambar, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: imageParts }],
            generationConfig: {
              responseModalities: ['IMAGE'],
              imageConfig: { aspectRatio: '1:1' },
            },
          }),
        });
        const data = await response.json();
        if (response.ok) {
          const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
          if (part?.inlineData?.data) {
            return res.json({
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
            });
          }
        } else {
          lastError = data?.error?.message || lastError;
        }
      }

      return res.status(400).json({ error: lastError });
    }

    // Mode Teks (Naskah Drama Iklan 10 Detik - 10 Menit & Prompt Adegan AI)
    const urlTeks = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    const response = await fetch(urlTeks, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [
            {
              text: 'Anda adalah penulis naskah drama pendek iklan UMKM dan prompt director AI video. Susun cerita yang mengalir, emosional, sesuai durasi, serta menyertakan prompt visual/video AI siap pakai.',
            },
          ],
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Gagal memanggil Gemini API.' });
    }

    const hasilTeks = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text: hasilTeks });
  } catch (err) {
    console.error('Error /api/gemini:', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server.' });
  }
});

// Menyajikan halaman Generator Drama & Iklan Video UMKM dari folder public
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server Generator Drama & Iklan Video UMKM berjalan di port ${PORT}`);
});