var mongoose = require ('mongoose');
var Schema = mongoose.Schema;
	
mongoose.connect('mongodb://localhost/infracciones_db', {
	useMongoClient : true
}, function(err){
	if (err){
		console.log('[InfraccionDB] - Error inesperado de conexión de BD: ' + err);
	}
});

var schInfraccion = mongoose.Schema({
	estado : {
		nombre: String,
		timestamp: Date,
		transicion_in: String,
		transicion_out: [String]
	},

	data : {
		infraccion_id : Number,
		num_compra: Number,
		publicacion_id : Number,
		comprador_id : Number,
		resultado_infraccion: String
	}
});

var Modelo = mongoose.model('Infraccion', schInfraccion);

module.exports = Modelo;