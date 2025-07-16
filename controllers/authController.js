// controllers/authController.js
import db from '../utils/db.js';
import bcrypt from 'bcrypt';

const signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    
    await db.query(sql, [name, email, hashedPassword]);
    res.redirect('/login');
  } catch (err) {
    console.error('Signup error:', err);
    res.send('Error during signup');
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM users WHERE email = ?';

  try {
    const [results] = await db.query(sql, [email]);
    if (results.length === 0) return res.send('Invalid Credentials');

    const user = results[0];

    // Compare hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send('Invalid Credentials');

    req.session.user = user;
    res.redirect('/welcome');
  } catch (err) {
    console.error('Login error:', err);
    res.send('Invalid Credentials');
  }
};

//========== DASHBOARD ==========
const getDashboard = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');

  const sql = 'SELECT * FROM bills WHERE user_id = ? ORDER BY date DESC';

  try {
    const [results] = await db.query(sql, [user.id]);

    // Initialize variables
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    let currentMonthUnits = 0;
    let currentMonthAmount = 0;
    let lastMonthUnits = 0;
    let lastMonthAmount = 0;
    let totalUnits = 0;
    let totalSpent = 0;
    let highestUsage = 0;
    let lowestUsage = Infinity;

    const monthWiseData = {};
    const recentBills = [];

    // Process bills
    results.forEach(bill => {
      const billDate = new Date(bill.date);
      const billMonth = billDate.getMonth() + 1;
      const billYear = billDate.getFullYear();

      // Convert to numbers to avoid NaN
      const units = parseFloat(bill.units) || 0;
      const amount = parseFloat(bill.amount) || (units * parseFloat(bill.rate || 0));

      totalUnits += units;
      totalSpent += amount;

      if (units > highestUsage) highestUsage = units;
      if (units < lowestUsage) lowestUsage = units;

      // Current month calculation
      if (billMonth === currentMonth && billYear === currentYear) {
        currentMonthUnits += units;
        currentMonthAmount += amount;
      }

      // Last month calculation (handles year boundary)
      if (billMonth === lastMonth && billYear === lastMonthYear) {
        lastMonthUnits += units;
        lastMonthAmount += amount;
      }

      // Monthly aggregation for chart
      const key = `${billYear}-${billMonth.toString().padStart(2, '0')}`;
      if (!monthWiseData[key]) {
        monthWiseData[key] = { units: 0, amount: 0, count: 0 };
      }
      monthWiseData[key].units += units;
      monthWiseData[key].amount += amount;
      monthWiseData[key].count += 1;

      // Recent bills for quick reference
      if (recentBills.length < 5) {
        recentBills.push({
          date: billDate.toLocaleDateString(),
          units: units,
          amount: amount
        });
      }
    });

    // Calculate averages
    const totalBills = results.length;
    const avgDailyUnits = totalBills > 0 ? totalUnits / totalBills : 0;
    const avgDailyAmount = totalBills > 0 ? totalSpent / totalBills : 0;

    // Prepare chart data (last 6 months)
    const chartLabels = Object.keys(monthWiseData)
      .sort()
      .slice(-6)
      .map(key => {
        const [year, month] = key.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { 
          month: 'short', 
          year: 'numeric' 
        });
      });
    
    const chartData = Object.keys(monthWiseData)
      .sort()
      .slice(-6)
      .map(key => monthWiseData[key].units);

    // Calculate month-over-month change
    const monthlyChange = lastMonthUnits > 0 
      ? Math.round(((currentMonthUnits - lastMonthUnits) / lastMonthUnits) * 100)
      : 0;

    // Calculate projected monthly cost
    const currentDayOfMonth = currentDate.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const projectedMonthlyUnits = currentMonthUnits > 0 
      ? Math.round((currentMonthUnits / currentDayOfMonth) * daysInMonth)
      : 0;
    const projectedMonthlyAmount = currentMonthAmount > 0 
      ? Math.round((currentMonthAmount / currentDayOfMonth) * daysInMonth)
      : 0;

    // Prepare dashboard data
    const dashboardData = {
      user: {
        name: user.name
      },
      summary: {
        currentMonth: { 
          units: currentMonthUnits, 
          amount: currentMonthAmount,
          projected: {
            units: projectedMonthlyUnits,
            amount: projectedMonthlyAmount
          }
        },
        lastMonth: { 
          units: lastMonthUnits, 
          amount: lastMonthAmount 
        },
        avgDaily: { 
          units: Math.round(avgDailyUnits), 
          amount: Math.round(avgDailyAmount) 
        },
        monthlyChange: monthlyChange
      },
      chart: {
        labels: chartLabels,
        data: chartData
      },
      stats: {
        totalBills: totalBills,
        highestUsage: highestUsage,
        lowestUsage: lowestUsage === Infinity ? 0 : lowestUsage,
        totalSpent: totalSpent,
        avgUnitsPerBill: totalBills > 0 ? Math.round(totalUnits / totalBills) : 0,
        avgAmountPerBill: totalBills > 0 ? Math.round(totalSpent / totalBills) : 0
      },
      recentBills: recentBills,
      insights: generateInsights(currentMonthUnits, lastMonthUnits, avgDailyUnits, monthlyChange)
    };

    res.render('dashboard', { dashboardData });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).render('error', { 
      message: 'Unable to fetch dashboard data' 
    });
  }
};

// Helper function to generate insights
function generateInsights(currentUnits, lastUnits, avgUnits, monthlyChange) {
  const insights = [];

  if (monthlyChange > 20) {
    insights.push({
      type: 'warning',
      message: `Your usage has increased by ${monthlyChange}% compared to last month. Consider energy-saving measures.`
    });
  } else if (monthlyChange < -10) {
    insights.push({
      type: 'success',
      message: `Great job! Your usage has decreased by ${Math.abs(monthlyChange)}% compared to last month.`
    });
  }

  if (currentUnits > avgUnits * 1.5) {
    insights.push({
      type: 'info',
      message: 'This month\'s usage is higher than your average. Check for energy-intensive appliances.'
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      message: 'Your electricity usage is within normal range. Keep monitoring for better savings!'
    });
  }

  return insights;
}

// ========== ADD BILL ==========
const addBill = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');

  const { date, units, rate } = req.body;
  const amount = units * rate;

  const sql = 'INSERT INTO bills (user_id, date, units, rate, amount) VALUES (?, ?, ?, ?, ?)';

  try {
    await db.query(sql, [user.id, date, units, rate, amount]);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Error inserting bill:', err);
    res.send('Failed to add bill');
  }
};

// Shows bills page

const getAllBills = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');

  const sql = 'SELECT * FROM bills WHERE user_id = ? ORDER BY date DESC';

  try {
    const [results] = await db.query(sql, [user.id]);
    
    // Ensure results is an array and process safely
    const bills = Array.isArray(results) ? results : [];
    
    console.log(`Found ${bills.length} bills for user ${user.name}`);
    
    res.render('bills', { bills, user });
  } catch (err) {
    console.error('Error fetching bills:', err);
    // Render with empty bills array instead of sending error
    res.render('bills', { bills: [], user });
  }
};

export default {
  signup,
  login,
  getDashboard,
  addBill,
  getAllBills
};