const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

let userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    select: false,
  },
  email: {
    type: String,
    required: true,
  },
  token: {
    type: String,
  },
  tokenExpireDate: {
    type: Date,
  },
});
userSchema.plugin(passportLocalMongoose);

User = mongoose.model("Users", userSchema);

module.exports = User;
