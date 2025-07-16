// app.js
import express from 'express';
import session from 'express-session';
import mysql from 'mysql2';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
// import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();

// Handle __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET, // ✅ use from .env
    resave: false,
    saveUninitialized: true,
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', authRoutes);
// app.use('/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
