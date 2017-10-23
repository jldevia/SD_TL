var mongoose = require ('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/envios_db', {
	useMongoClient : true
});

var schShipment = new Schema({
	numero : { type : Number, required : true},
	num_compra : {type : Number, required : true},
	costo: Number,
	fecha_envio : Date
});

var Shipment = mongoose.model('Shipment', schShipment);

module.exports = Shipment;