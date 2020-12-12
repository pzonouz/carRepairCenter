const express = require("express");

const app = express();
// const cookieParser = require("cookie-parser");
// const debug = require("debug");
// Passport js default session is session but I want to remember after broswer exit.
const session = require("cookie-session");
// for parsing body in post requests.
const bodyParser = require("body-parser");
// flash messages as success or error
const flash = require("connect-flash");
// mongodb ORM
const mongoose = require("mongoose");
// log in terminal throught node running
const logger = require("morgan");
// CORS
const cors = require("cors");
// authentication tool
const passport = require("./modules/authenticate");
// I put some config data in there
const config = require("./modules/config");
// routing module
const router = require("./modules/routes");

/**---------------------------------------------------------
 * ?Use and Set
 */
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    name: "carRepair",
    keys: ["peymankhalili"],
    maxAge: 1000 * 60 * 60 * 24 * 10,
  })
);
// app.use(morgan("combined"));
app.use(flash());
app.use(logger("dev"));
app.use((req, res, next) => {
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});
app.use(passport.initialize());
app.use(passport.session());
// const corsOptions = {
//   origin: "http://localhost:5000",
// };
app.use(cors());
// Always use in the end
app.use(router);
/**---------------------------------------------------------
 * ?Connect Database
 */
mongoose
  .connect(config.MONGODB_ATLAS, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  })
  .then(() => {
    console.log("Successfully connect to database");
  })
  .catch((err) => {
    console.log(err);
  });
/**---------------------------------------------------------
 * ?Server listening
 */
app.listen(config.PORT, () => {
  console.log("Server is listening on port:", config.PORT);
});
