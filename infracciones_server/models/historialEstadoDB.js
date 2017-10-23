var mongoose = require ('mongoose');
var Schema = mongoose.Schema;
	
mongoose.connect('mongodb://localhost/infracciones_db', {
	useMongoClient : true
}, function(err){
	if (err){
		console.log('[HistorialEstadoDB] - Error inesperado de conexión de BD: ' + err);
	}
});

var schHistorial = mongoose.Schema({
	num_compra : Number,
	infraccion_id : Number,
	historial : [{
		nombre: String,
		timestamp: Date,
		transicion_in: String,
		transicion_out: [String]
	}],
});

var Modelo = mongoose.model('HistorialEstado', schHistorial);

module.exports = Modelo;
