const mongoose = require("mongoose");
let sequentalNumbers = new mongoose.Schema({
  seqNumber: { type: String, required: true },
//   firstTime: { type: Boolean, required: true },
});
let sequentalNumber = mongoose.model("sequentalNumber", sequentalNumbers);
module.exports = sequentalNumber;
