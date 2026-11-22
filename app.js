// Server Express.js untuk Generator Drama & Iklan Video UMKM (ES Module - Kompatibel Railway & Express 5)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Penyimpanan sementara video hasil gabungan agar Android WebView / APK bisa mengunduh via HTTP GET asli
const tempVideoStore = new Map();

app.post('/api/save-video', (req, res) => {
  try {
    const { base64, mimeType, filename } = req.body || {};
    if (!base64) {
      return res.status(400).json({ error: 'Data video kosong.' });
    }
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const buffer = Buffer.from(base64, 'base64');
    const cleanMime = (mimeType || 'video/webm').split(';')[0];
    const safeName = (filename || 'drama_iklan_umkm.webm').replace(/[^a-zA-Z0-9._-]/g, '_');

    tempVideoStore.set(id, { buffer, mimeType: cleanMime, filename: safeName, createdAt: Date.now() });

    // Bersihkan file sementara yang lebih dari 15 menit
    for (const [key, item] of tempVideoStore.entries()) {
      if (Date.now() - item.createdAt > 15 * 60 * 1000) {
        tempVideoStore.delete(key);
      }
    }

    return res.json({
      downloadUrl: `/api/download-video/${id}/${encodeURIComponent(safeName)}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menyiapkan unduhan video.' });
  }
});

app.get('/api/download-video/:id/:filename', (req, res) => {
  const item = tempVideoStore.get(req.params.id);
  if (!item) {
    return res.status(404).send('File video sudah kedaluwarsa, silakan tekan Gabung & Simpan ulang.');
  }
  res.setHeader('Content-Type', item.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${item.filename}"`);
  res.setHeader('Content-Length', item.buffer.length);
  return res.send(item.buffer);
});

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