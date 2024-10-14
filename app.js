require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = express();
const User = require('./models/userModel');

app.use(express.json());

// Connect to MongoDB using environment variable
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Error connecting to MongoDB:', err);
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // No token, unauthorized

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Invalid token, forbidden
        req.user = user; // Attach user info to request object
        next(); // Move to the next middleware
    });
};

// In-memory store for used tokens (to invalidate them after use)
const usedTokens = new Set();

// Protected route for creating a user (requires valid token)
app.post('/api/v1/users', authenticateToken, async (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    
    if (usedTokens.has(token)) {
        return res.status(403).json({ msg: 'Token has already been used. Please request a new token.' });
    }

    try {
        const { username, password } = req.body;
        const newUser = new User({ username, password });
        await newUser.save();
        
        // Mark token as used
        usedTokens.add(token);

        res.status(201).json({
            msg: 'User created successfully',
            data: newUser
        });
    } catch (error) {
        res.status(500).json({
            msg: 'Error creating user',
            error: error.message
        });
    }
});

// Public route to authenticate (login) and get JWT token
app.post('/api/v1/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username, password });
    if (!user) {
        return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
    );

    res.json({ msg: 'Logged in successfully', token });
});

// Protected route to get all users
app.get('/api/users', authenticateToken, async (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];

    if (usedTokens.has(token)) {
        return res.status(403).json({ msg: 'Token has already been used. Please request a new token.' });
    }

    try {
        const users = await User.find();
        // Mark token as used
        usedTokens.add(token);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Start the server using the port from .env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
