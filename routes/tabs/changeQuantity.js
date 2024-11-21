const express = require('express');
const router = express.Router();
const AggregatedBatch = require('../../models/aggregatedBatch'); // Ensure correct path

// GET route to render the Change Quantity page
router.get('/:batchNumber/changeQuantity', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });

    if (!batch) return res.status(404).send('Batch not found');

    // Calculate total trays sold and total trays lost
    const traysSold = batch.logs
      .filter(log => log.type === 'sale')
      .reduce((sum, log) => sum + log.count, 0);

    const traysLost = batch.logs
      .filter(log => log.type === 'mortality')
      .reduce((sum, log) => sum + log.count, 0);

    res.render('tabs/changeQuantity', { batch, traysSold, traysLost });
  } catch (err) {
    console.error('Error loading Change Quantity page:', err);
    res.status(500).send('Error loading page');
  }
});

// POST route to handle tray updates
router.post('/:batchNumber/changeQuantity', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { actionType, quantity, customerName, shipDate } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });

    if (!batch) return res.status(404).send('Batch not found');

    const quantityNumber = parseInt(quantity, 10);

    if (actionType === 'sale') {
      batch.logs.push({
        type: 'sale',
        details: `Sold to ${customerName || 'Unknown'}`,
        count: quantityNumber,
        timestamp: shipDate ? new Date(shipDate) : new Date(),
      });
    } else if (actionType === 'mortality') {
      batch.logs.push({
        type: 'mortality',
        details: 'Trays lost',
        count: quantityNumber,
        timestamp: new Date(),
      });
    }

    batch.totalTrayCount -= quantityNumber; // Deduct quantity for both sales and mortality
    if (batch.totalTrayCount < 0) batch.totalTrayCount = 0; // Ensure count doesn't go negative

    await batch.save();
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}/changeQuantity`);
  } catch (err) {
    console.error('Error updating quantity:', err);
    res.status(500).send('Error processing update');
  }
});

module.exports = router;
