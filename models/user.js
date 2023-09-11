const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
	name: {
		type: String,
		unique: true,
	},
	email: {
		type: String,
		unique: true,
		lowercase: true
	},
	password: String,
	verified: {
		type: Boolean
	},
	userType: {
		type: String,
		lowercase: true
	},
	image: String,
	sessionId: String,
	sessionInfo: Map
})


const userModel = mongoose.model('User', userSchema);

module.exports = userModel;