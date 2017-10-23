const MongoClient = require('mongodb').MongoClient;

'use strict';

class InfraccionDB {
	constructor(refServer){
		this.url = 'mongodb://localhost:27017/infracciones_db';

		this.server = refServer;
	}

	persistir(){
		MongoClient.connect(this.url, (err, db) => {
			if (err) {
				console.error('[Infracciones_server] - Error inesperado de Conexión de BD: ' + err);
				this.server.logMensaje('[Infracciones_server] - Error inesperado de Conexión de BD: ' + err);
			}else{
				db.collection('estado').insertMany([{num_compra: 2546}, {num_compra : 789}]);
			}
		});
	}
}

var datos = new InfraccionDB();

datos.persistir();