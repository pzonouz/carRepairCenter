const PORT = 5000;
const LOCAL_DATABASE = "mongodb://127.0.0.1:27017/carRepairCenter";
const MONGODB_ATLAS =
  "mongodb+srv://peyman:passwordforproject@cluster0.nf4ub.mongodb.net/carRepairCenter?retryWrites=true&w=majority";
const GMAIL_USERNAME = "emailforcarrepaircenter@gmail.com";
const GMAIL_PASSWORD = "passwordforproject";
const DELAY_CRITERIA = 1; // days

module.exports = {
  MONGODB_ATLAS,
  PORT,
  LOCAL_DATABASE,
  GMAIL_USERNAME,
  GMAIL_PASSWORD,
  DELAY_CRITERIA,
};
