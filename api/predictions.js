// Vercel Serverless Function — GET and POST predictions
// Stores data in a GitHub repo file via the Contents API

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'atomlinsonc';
const REPO_NAME = 'mlb-prediction-scoreboard';
const FILE_PATH = 'data/predictions.json';
const BRANCH = 'master';

const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

// Read current predictions from GitHub
async function readPredictions() {
    const resp = await fetch(GITHUB_API + `?ref=${BRANCH}`, {
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (resp.status === 404) return { data: {}, sha: null };
    if (!resp.ok) throw new Error(`GitHub read failed: ${resp.status}`);

    const json = await resp.json();
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    return { data: JSON.parse(content), sha: json.sha };
}

// Write predictions back to GitHub
async function writePredictions(data, sha) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const body = {
        message: `Update predictions`,
        content,
        branch: BRANCH
    };
    if (sha) body.sha = sha;

    const resp = await fetch(GITHUB_API, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`GitHub write failed: ${resp.status} ${err}`);
    }
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const { data } = await readPredictions();
            return res.status(200).json(data);
        }

        if (req.method === 'POST') {
            const { name, al, nl } = req.body;

            if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 30) {
                return res.status(400).json({ error: 'Name is required (max 30 chars).' });
            }
            if (!Array.isArray(al) || al.length !== 15 || !Array.isArray(nl) || nl.length !== 15) {
                return res.status(400).json({ error: 'Must provide exactly 15 AL and 15 NL teams.' });
            }

            const { data, sha } = await readPredictions();
            data[name.trim()] = { al, nl, submittedAt: new Date().toISOString() };
            await writePredictions(data, sha);

            return res.status(200).json({ ok: true, total: Object.keys(data).length });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('API error:', err);
        return res.status(500).json({ error: 'Server error. Please try again.' });
    }
}
