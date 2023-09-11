const User = require("../models/user.js")

async function findSession(id) {
	try {
		const findId = await User.findOne({ sessionId: id })

		return findId;

	} catch (err) {
		return ("Error: ", err);
	}
}



async function saveSession(id, session) {
	const sessionMap = new Map()
	
	try {
		const idExists = await User.findOne({ sessionId: id });

		if ( !idExists ){
			return ("Invalid session Id")
		}

		idExists.sessionInfo = sessionMap.set(id, session);

		idExists.save()
	} catch (err) {
		return ("Error: ", err);
	}
}


async function findAllSessions() {
	try {
		const allSessions = await User.find({ sessionInfo })

		return (allSessions)
	} catch (err) {
		return ("Error: ", err);
	}
}

module.exports = {
	findSession,
	findAllSessions,
	saveSession
}