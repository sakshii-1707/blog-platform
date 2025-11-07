const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');

const app = express();
app.use(express.json());
app.use(morgan('tiny'));

const PORT = 4002;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/posts';

mongoose.connect(MONGO_URL).then(() => console.log('Post MongoDB connected')).catch(console.error);

// Health
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', service: 'post' }));

// Posts API
app.use('/api/v1/posts', require('./routes/post'));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

app.listen(PORT, () => console.log(`Post service listening on ${PORT}`));
