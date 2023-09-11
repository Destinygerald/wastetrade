const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema({
	listId: String,
	amountOffered: Number,
	proposer: String,
	dateOffered: Date
})

const offerModel = mongoose.model("Offers", offerSchema);

module.exports = offerModel