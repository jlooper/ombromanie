module.exports = function (context) {
	let key = process.env['VUE_APP_SPEECH_KEY'];
	context.res = { body: key };
	context.done();
};
