const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  name: { type: String },
  lastName: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true, index: true },
});
const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
