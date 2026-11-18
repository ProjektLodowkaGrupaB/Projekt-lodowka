const express = require('express');
const cors = require('cors');
require('dotenv').config({ quiet: true });

const pantryRoutes = require('./routes/pantryRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const equipmentRoutes = require('./routes/equipmentRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ message: 'API działa poprawnie!' });
});

app.use('/api', pantryRoutes);
app.use('/api', recipeRoutes);
app.use('/api', equipmentRoutes);
app.use('/api', ingredientRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Nie znaleziono zasobu.' });
});

app.use(errorHandler);

module.exports = app;
