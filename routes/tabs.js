const express = require('express');
const router = express.Router();
const AggregatedBatch = require('../models/aggregatedBatch');
const Bench = require('../models/bench');

// Fetch and display batch details
router.get('/:batchNumber', async (req, res) => {
  try {
    const { batchNumber } = req.params;

    // Fetch batch details
    const batch = await AggregatedBatch.findOne({ batchNumber });
    if (!batch) return res.status(404).send('Batch not found');

    // Fetch all benches for Move Bench tab
    const benches = await Bench.find({}, 'Row').sort({ Row: 1 });

    // Pass currentRow and benches to the template
    res.render('batch', {
      batch,
      currentRow: batch.currentRow,
      benches,
    });
  } catch (err) {
    console.error('Error fetching batch:', err);
    res.status(500).send('Error fetching batch');
  }
});

module.exports = router;
