const mongoose = require("mongoose");
let customerSchema = new mongoose.Schema({
  name: { type: String },
  lastName: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true, index: true },
});
let Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
