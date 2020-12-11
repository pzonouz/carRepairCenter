let { PORT } = process.env;
if (PORT == null || PORT == "") {
  PORT = 5000;
}
// const LOCAL_DATABASE = "mongodb://127.0.0.1:27017/carRepairCenter";
const MONGODB_COMPASS =
  "mongodb+srv://peyman:<password>@cluster0.nf4ub.mongodb.net/<dbname>?retryWrites=true&w=majority";
const GMAIL_USERNAME = "p.zonouz@gmail.com";
const GMAIL_PASSWORD = "peyman1363";
const DELAY_CRITERIA = 1; // days

module.exports = {
  PORT,
  LOCAL_DATABASE,
  GMAIL_USERNAME,
  GMAIL_PASSWORD,
  DELAY_CRITERIA,
};
