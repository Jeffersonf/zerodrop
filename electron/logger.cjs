const fs = require('fs');
process.on('uncaughtException', (err) => {
  fs.writeFileSync(path.join(__dirname, '../electron_error.log'), err.stack || String(err));
});
process.on('unhandledRejection', (err) => {
  fs.writeFileSync(path.join(__dirname, '../electron_error.log'), err.stack || String(err));
});
