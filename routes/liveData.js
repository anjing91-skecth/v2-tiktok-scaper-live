const express = require('express');
const router = express.Router();

let liveDataStore = {};
function injectState(state) {
    liveDataStore = state.liveDataStore;
}

router.get('/live-data', (req, res) => {
    res.json(liveDataStore);
});

module.exports = { router, injectState };
