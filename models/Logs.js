const mongoose = require("mongoose");

const Operation = {
  changeStatus: "changeStatus",
  modify: "modify",
  remove: "remove",
  create: "create",
};
const logSchema = new mongoose.Schema({
  receptionNewStatus: { type: String },
  operationType: { type: String, required: true },
  reception_id: { type: Number, required: true },
  username: { type: String, required: true },
  log_id: { type: Number, required: true, unique: true, index: true },
});
const Log = mongoose.model("Logs", logSchema);
module.exports = { Log, Operation };
