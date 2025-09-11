require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Supabase client (use service role or anon depending on security model)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Simple token map (for demo). For production, use signed JWTs or proper session store.
const sessions = new Map();
function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing' });
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('users').insert([{ email, password_hash: hash }]).select().single();
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = createToken();
    sessions.set(token, { userId: user.id, createdAt: Date.now() });
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Middleware auth
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No auth' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid auth header' });
  const token = parts[1];
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Invalid token' });
  const user = await getUserById(session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  next();
}

// Alerts endpoints
app.get('/api/alerts', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('alerts').select('*').eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ alerts: data || [] });
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/alerts', authMiddleware, async (req, res) => {
  try {
    const { address, alert, time } = req.body;
    if (!address || !alert || !time) return res.status(400).json({ error: 'Missing fields' });
    const { data, error } = await supabase.from('alerts').insert([{
      user_id: req.user.id, address, alert, time, pinned: false, deleted: false, modified: new Date().toISOString()
    }]).select().single();
    if (error) throw error;
    return res.json({ alert: data });
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/alerts/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    updates.modified = new Date().toISOString();
    const { data, error } = await supabase.from('alerts').update(updates).match({ id, user_id: req.user.id }).select().single();
    if (error) throw error;
    return res.json({ alert: data });
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/alerts/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from('alerts').update({ deleted: true, modified: new Date().toISOString() }).match({ id, user_id: req.user.id }).select().single();
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/alerts/:id/restore', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from('alerts').update({ deleted: false, modified: new Date().toISOString() }).match({ id, user_id: req.user.id }).select().single();
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, ()=> console.log(`Server running on port ${PORT}`));
