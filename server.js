const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debug: Check if env variables are loaded
console.log('MONGODB_URI loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');

const User = require('./models/User');
const Student = require('./models/Student');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Initialize admin account
const initializeAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@ojt.com' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        email: 'admin@ojt.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('✅ Admin account created');
    }
  } catch (error) {
    console.error('Error creating admin:', error);
  }
};

initializeAdmin();

// Routes

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      role: user.role,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, ...studentData } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      role: 'student'
    });
    
    const student = await Student.create({
      userId: user._id,
      email,
      fullName: studentData.fullName,
      department: studentData.department,
      project: studentData.department === 'IT' ? studentData.project : undefined,
      skills: studentData.skills.split(',').map(s => s.trim()).filter(s => s),
      school: studentData.school,
      course: studentData.course,
      yearLevel: studentData.yearLevel,
      contactNumber: studentData.contactNumber,
      address: studentData.address,
      startDate: studentData.startDate,
      endDate: studentData.endDate
    });
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Get student profile
app.get('/api/student/:userId', async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.params.userId });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// Get all students (admin)
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get students' });
  }
});

// Update student profile
app.put('/api/student/:userId', async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { userId: req.params.userId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

// Delete student
app.delete('/api/student/:studentId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    
    await User.findByIdAndDelete(student.userId);
    await Student.findByIdAndDelete(req.params.studentId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
