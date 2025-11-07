const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');

const app = express();
app.use(express.json());
app.use(morgan('tiny'));

const PORT = 4003;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/comments';

mongoose.connect(MONGO_URL).then(() => console.log('Comment MongoDB connected')).catch(console.error);

// Health
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', service: 'comment' }));

// Comments API
app.use('/api/v1/comments', require('./routes/comment'));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

app.listen(PORT, () => console.log(`Comment service listening on ${PORT}`));
