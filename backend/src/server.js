require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, seedDemoData } = require('./database');
const errorHandler = require('./middleware/errorHandler');

const paymentsRouter = require('./routes/payments');
const analysisRouter = require('./routes/analysis');
const recoveryRouter = require('./routes/recovery');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'PayRecover AI Backend'
  });
});

app.use('/api/payments', paymentsRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/recovery', recoveryRouter);
app.use('/api/audit', auditRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.path} not found`
  });
});

app.use(errorHandler);

try {
  initDb();
  seedDemoData();
  console.log('Database initialized and seeded');
} catch (err) {
  console.error('Database initialization failed:', err);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`PayRecover AI Backend running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    console.log('OpenAI: API key detected');
  } else {
    console.log('OpenAI: Using fallback analysis');
  }
});
