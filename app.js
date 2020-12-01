const express = require("express");
const app = express();
const router = require("./modules/routes");
const config = require("./modules/config");
const cookieParser = require("cookie-parser");
const session = require("cookie-session");
const bodyParser = require("body-parser");
const flash = require("connect-flash");
const passport = require("./modules/authenticate");
const mongoose = require("mongoose");
const logger = require("morgan");

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
//Always use in the end
app.use(router);

/**---------------------------------------------------------
 * ?Connect Database
 */
mongoose
  .connect(config.LOCAL_DATABASE, {
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
