const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const port = 3002;

// MongoDB connection
mongoose
  .connect(
    'mongodb+srv://SuenoFarms:bestliners@cluster0.imrxbn0.mongodb.net/myDatabase?retryWrites=true&w=majority',
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define schema and model for aggregated batches
const aggregatedBatchSchema = new mongoose.Schema({
  batchNumber: String,
  totalTrayCount: Number,
  currentRow: String,
  rootingProgress: String,
  photos: Array,
  logs: Array,
  status: String,
});

const AggregatedBatch = mongoose
  .connection
  .useDb('myDatabase')
  .model('AggregatedBatch', aggregatedBatchSchema, 'aggregatedBatches');

// Define schema and model for benches
const benchSchema = new mongoose.Schema({
  Row: String,
});

const Bench = mongoose.connection
  .useDb('myDatabase') // Database: myDatabase
  .model('Bench', benchSchema, 'Benches'); // Collection: Benches

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// Routes

// Root route to fetch and display batch numbers
app.get('/', async (req, res) => {
  try {
    const batches = await AggregatedBatch.find({ status: 'active' }, 'batchNumber').sort({
      batchNumber: 1,
    });
    res.render('index', { batches });
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).send('Error loading batches');
  }
});

// Batch details route
// Batch details route
// Batch details route
app.get('/batch/:batchNumber', async (req, res) => {
    try {
      const { batchNumber } = req.params;
  
      // Fetch the batch details
      const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
      if (!batch) return res.status(404).send('Batch not found');
  
      // Fetch all rows (benches) from the Benches collection
      const benches = await Bench.find({}, 'Row');
      console.log('Using database:', mongoose.connection.name); // Log active database
      console.log('Fetched benches:', benches.map((bench) => bench.Row)); // Debugging
  
      // Render the batch view with fetched data
      res.render('batch', {
        batch,
        currentRow: batch.currentRow || 'Unknown',
        benches: benches.map((bench) => bench.Row), // Send only the `Row` values to the template
      });
    } catch (err) {
      console.error('Error fetching batch details:', err);
      res.status(500).send('Error loading batch details');
    }
  });
  
  

// Update rooting progress route
app.post('/batch/:batchNumber/update-rooting', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { rootingProgress } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    batch.rootingProgress = rootingProgress;
    await batch.save();

    console.log(`Updated rooting progress for ${batchNumber} to ${rootingProgress}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error updating rooting progress:', err);
    res.status(500).send('Error updating rooting progress');
  }
});

// Update quantity died route
app.post('/batch/:batchNumber/update-quantity-died', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { quantityDied } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    const diedNumber = parseInt(quantityDied, 10);

    // Log trays died and deduct from totalTrayCount
    batch.logs.push({
      type: 'mortality',
      details: 'Trays lost',
      count: diedNumber,
      timestamp: new Date(),
    });

    batch.totalTrayCount -= diedNumber;
    if (batch.totalTrayCount < 0) batch.totalTrayCount = 0; // Prevent negative totalTrayCount

    await batch.save();
    console.log(`Updated quantity for ${batchNumber}: Mortality of ${diedNumber}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error updating quantity died:', err);
    res.status(500).send('Error updating quantity died');
  }
});

// Move bench route
app.post('/batch/:batchNumber/move-bench', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { newBench } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    const benches = await Bench.find({}, 'Row'); // Fetch all benches to verify the newBench
    const validBenches = benches.map((bench) => bench.Row);

    if (!validBenches.includes(newBench)) {
      return res.status(400).send('Invalid bench selected');
    }

    // Log the bench movement and update currentRow
    batch.logs.push({
      type: 'movement',
      details: `Moved to ${newBench}`,
      timestamp: new Date(),
    });

    batch.currentRow = newBench;

    await batch.save();
    console.log(`Moved ${batchNumber} to ${newBench}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error moving bench:', err);
    res.status(500).send('Error moving bench');
  }
});

// Start Server
app.listen(port, () => console.log(`Batch Selector App running at http://localhost:${port}`));
