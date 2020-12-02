const mongoose = require("mongoose");

const sequentalNumbers = new mongoose.Schema({
  seqNumber: { type: String, required: true },
  //   firstTime: { type: Boolean, required: true },
});
const sequentalNumber = mongoose.model("sequentalNumber", sequentalNumbers);
module.exports = sequentalNumber;
