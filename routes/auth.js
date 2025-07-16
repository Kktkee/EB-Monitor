import express from 'express';
import db from '../utils/db.js'; // adjust path if needed
import authController from '../controllers/authController.js';

const router = express.Router();

// Public pages
router.get('/', (req, res) => res.render('landing'));
router.get('/login', (req, res) => res.render('login'));
router.get('/signup', (req, res) => res.render('signup'));

// Auth POST routes
router.post('/login', authController.login);
router.post('/signup', authController.signup);

// Authenticated routes
router.get('/dashboard', authController.getDashboard);

router.get('/add-bill', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('addBill');
});

router.get('/dashboard/add-bill', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('addBill');
});


router.get('/bills', authController.getAllBills);

// ✅ Welcome page after login
router.get('/welcome', (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');
  res.render('welcome', { name: user.name });
});

// Bill submission route
router.post('/dashboard/add-bill', authController.addBill);

export default router;