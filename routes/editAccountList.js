const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const accountFilePath = path.join(__dirname, '../account.txt');

router.post('/edit-list', (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames)) {
        return res.status(400).json({ error: 'Usernames must be an array.' });
    }
    fs.writeFileSync(accountFilePath, usernames.join('\n'));
    res.json({ message: 'Username list updated.', usernames });
});

router.get('/get-list', (req, res) => {
    try {
        const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
        res.json({ usernames });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read username list.' });
    }
});

module.exports = router;
