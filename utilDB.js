var MongoClient = require('mongodb').MongoClient;
var _ = require('underscore');

var UtilDB = function(){
	function guardarEstado(urlDB, registros){
		MongoClient.connect(urlDB, function(err, db){
			if (err){
				console.log('[Guardar Estado] - Error inesperado de conexión a la BD: ' + err.message);
				return;
			}

			var col = db.collection('registros');

			_.forEach(registros, (item) =>{
				console.log('Guardando: '+ item.data);
				if (item.data.num_compra) {
					var reg = new Object();
					reg.data = item.data;
					reg.estado = item.estado;
					reg.eventos_pendientes = item.eventosPendientes;				
					col.updateOne({num_compra : item.data.num_compra}, reg, {upsert : true}, function(err, result){
						if(err){
							console.log('[Guardar Estado] - Error inesperado al actualizar registro en la BD: ' + err.message );
						}
					});
				}
			});

			db.close();
		});
	}

	function recuperarEstado(urlDB){
		var result;
		
		MongoClient.connect(urlDB, (err, db) => {
			if(err){
				console.log('[Recuperar Estado] - Error inesperado de conexión a la BD: ' + err.message);
			}
			
			var col = db.collection('registros');

			col.find().toArray( (err, docs) => {
				if(err){
					console.log('[Recuperar Estado] - Error inesperado al recuperar registros: ' + err.message);
				}
				result = docs;
			} );

			db.close();
		});

		return result;
	}

	function clearEstado(urlDB){
		MongoClient.connect(urlDB, (err, db) =>{
			if(err){
				console.log('[Clear Estado] - Error inesperado de conexión a la BD: ' + err.message);
			}

			var col = db.collection('registros');

			col.deleteMany(null, (err, result) =>{
				if (err) {
					console.log('[Clear Estado] - Error inesperado al eliminar registros de la BD: ' + err.message);
				}
			});

			db.close();
		});
	}

	return {
		guardarEstado : guardarEstado,
		recuperarEstado : recuperarEstado,
		clearEstado : clearEstado
	};

}();

module.exports = UtilDB;