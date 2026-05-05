const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const app = express()

// Security headers
app.use(helmet())

// JSON body parse
app.use(express.json())

// Allow CORS from the frontend URL, and allow credentials (cookies)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))

// Log every incoming request to the terminal — METHOD, path, status, response time
app.use(morgan('dev'))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Jega server is running' })
})

// All API routes will be prefixed with /api/v1
app.use('/api/v1', (req, res) => {
  res.json({ message: 'API v1 ready' })
})

module.exports = app