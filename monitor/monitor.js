var util = require ('../util.js');
const _ = require('underscore');

class Monitor{
	constructor(http1){

		this.conexiones = new Array();

		this.socket1 = require('socket.io')(http1);//socket para comunicacion con la pagina web del monitor
		this.socket2 = require('socket.io')(17852);//socket para comunicación con los servidores

		console.log('Monitor en ejecución...');	
		//Eventos socket1
		this.socket1.on('connection', (sck) => {
			console.log('Nueva conexión!!');
			//console.log(sck.handshake);
			
			sck.on('ejecutarSimulacionAUT', (data) => this.ejecutarSimulacionAUT(data));
			sck.on('ejecutarSimulacionPAP', (data) => this.ejecutarSimulacionPAP(data));
		});

		//Eventos socket2
		this.socket2.on('connection', (sck) => {
			var newCliente = new Object();
			newCliente.id = sck.id;
			newCliente.server = sck.handshake.query.origen;
			this.conexiones.push(newCliente);

			console.log(this.conexiones);
			
			sck.on('disconnect', (reason) =>{
				console.log('Desconexion del cliente con id: ' + sck.id);
				//this.deleteClienteById(sck.id);
				//console.log(this.conexiones);
			});
			
			sck.on('logMensaje', (data) => this.procesarMsg(data));
		});

	}

	ejecutarSimulacionAUT(data){
		util.execSimulacion();
	}

	ejecutarSimulacionPAP(data){

	}

	procesarMsg(data){
		this.socket1.emit('logMsg', data);
	}

	getClienteById(id){
		_.find(this.conexiones, (item) => {
			return item.id === id;
		});
	}

	getClienteByName(name){
		_.find(this.conexiones, (item) =>{
			return item.server === name;
		});
	}

	deleteClienteById(id){
		_.each(this.conexiones, (item, index) => {
			if ( item.id === id ){
				this.conexiones.splice(index, 1);
			}
		});
	}
	
}

module.exports = Monitor;

//var mon = new Monitor();