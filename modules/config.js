const PORT = process.env.PORT || 5000;
const LOCAL_DATABASE = "mongodb://127.0.0.1:27017/carRepairCenter";
const MONGODB_ATLAS =
  "mongodb+srv://peyman:passwordforproject@cluster0.nf4ub.mongodb.net/carRepairCenter?retryWrites=true&w=majority" ||
  process.env.MONGODB_ATLAS;
const GMAIL_USERNAME =
  "emailforcarrepaircenter@gmail.com" || process.env.GMAIL_USERNAME;
const GMAIL_PASSWORD = "passwordforproject" || process.env.GMAIL_PASSWORD;
const DELAY_CRITERIA = 1 || process.env.DELAY_CRITERIA; // days

module.exports = {
  MONGODB_ATLAS,
  PORT,
  LOCAL_DATABASE,
  GMAIL_USERNAME,
  GMAIL_PASSWORD,
  DELAY_CRITERIA,
};
