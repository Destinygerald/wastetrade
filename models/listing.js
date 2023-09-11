const mongoose = require("mongoose");
const { Schema } = mongoose;


const OfferSchema = new Schema({
	listId: String,
	amountOffered: Number,
	proposer: String,
	dateOffered: Date
})

const listingSchema = new Schema({
	userId: String,
	dateListed: Date,
	fulfilled: Boolean,
	wasteInfo: String,
	image: String,
	offers: [OfferSchema],
})

const listingModel = mongoose.model("Listings", listingSchema);

module.exports = listingModel;