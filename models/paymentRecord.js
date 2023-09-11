const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentSchema = new Schema({
	full_name: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	},
	amount: {
		type: Number,
		required: true
	},
	reference: {
		type: String,
		required: true,
		unique: true
	},
	status: {
		type: String,
		required: true
	},
}, {
	timestamps: true
})

const paymentModel = mongoose.model("paymentModel", paymentSchema)

module.exports = paymentModel