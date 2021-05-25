const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json());

const boatRouter = require('./api/boat');
const loadRouter = require('./api/load');

app.get('/', (req, res) => {
  res.send("Boats and Loads...");
});

app.use('/boats', boatRouter);
app.use('/loads', loadRouter);

// Error handling
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).send({
    Error: err.message
  });
});


// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});