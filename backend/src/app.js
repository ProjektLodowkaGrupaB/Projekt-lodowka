const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routerów
const pantryRoutes = require('./routes/pantryRoutes');
const recipeRoutes = require('./routes/recipeRoutes');

const app = express();

// Middleware
app.use(express.json());

app.use(cors({
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Endpoint testowy
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'API działa poprawnie!'
    });
});

// Podłączenie routerów
app.use('/api', pantryRoutes);
app.use('/api', recipeRoutes);

// Middleware obsługi błędów
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;