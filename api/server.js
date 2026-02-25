import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'predictions.json');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Load predictions from disk
function loadPredictions() {
    if (!existsSync(DATA_FILE)) return {};
    try {
        return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

// Save predictions to disk
function savePredictions(data) {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /predictions — return all predictions
app.get('/predictions', (req, res) => {
    res.json(loadPredictions());
});

// POST /predictions — add or update a player's predictions
app.post('/predictions', (req, res) => {
    const { name, al, nl } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 30) {
        return res.status(400).json({ error: 'Name is required (max 30 chars).' });
    }
    if (!Array.isArray(al) || al.length !== 15 || !Array.isArray(nl) || nl.length !== 15) {
        return res.status(400).json({ error: 'Must provide exactly 15 AL and 15 NL teams.' });
    }

    const predictions = loadPredictions();
    predictions[name.trim()] = { al, nl, submittedAt: new Date().toISOString() };
    savePredictions(predictions);

    res.json({ ok: true, total: Object.keys(predictions).length });
});

// DELETE /predictions/:name — remove a player
app.delete('/predictions/:name', (req, res) => {
    const predictions = loadPredictions();
    const name = decodeURIComponent(req.params.name);
    if (!predictions[name]) {
        return res.status(404).json({ error: 'Player not found.' });
    }
    delete predictions[name];
    savePredictions(predictions);
    res.json({ ok: true });
});

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'mlb-predictions-api' });
});

app.listen(PORT, () => {
    console.log(`MLB Predictions API running on port ${PORT}`);
});
