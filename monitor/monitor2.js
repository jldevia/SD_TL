var util = require ('../util.js');
const _ = require('underscore');
const EventEmitter = require('events').EventEmitter;

class Monitor extends EventEmitter{
	constructor(){
		super();
		
		this.clientes = new Array();
		
		this.socket1 = require('socket.io')(17850);//socket para comunicacion con cliente Web
		this.socket2 = require('socket.io')(17852);//socket para comunicación con los servidores

		this.socket1.on('connection', (sck) => {
			sck.on('ejecutarSimulacionAUT', (data) => this.ejecutarAUT(data));
			sck.on('ejecutarSimulacionPAP', (data) => this.ejecutarPAP(data));
			sck.on('nuevaCompra', (data)=> this.iniciarNuevaCompra(data));
			sck.on('getCompras', (data) => this.recuperarCompras(data));
			sck.on('getEstado', (data) => this.recuperarEstado(data));
			sck.on('avanzar', (data) => this.avanzarCompra(data));
			sck.on('bajaServidor', (data) => this.solicitarBajaServidor(data));
		});

		this.socket2.on('connection', (sck) => {
			var newCliente = new Object();
			newCliente.id = sck.id;
			newCliente.server_name = sck.handshake.query.origen;
			this.clientes.push(newCliente);

			console.log(this.clientes);

			//**********Eventos***************/
			sck.on('estadoCompra', (data) => this.informarEstadocompra(data, sck));
			sck.on('listadoCompras', (data) => this.informarListadoCompras(data, sck));

			sck.on('disconnect', (reason) => {
				console.log(sck.id);
				this.deleteClientById(sck.id);
			});
				
		});
	}

	// ******Tratamiento de eventos del monitor***************
	ejecutarAUT(){
		util.execSimulacion();
	}

	ejecutarPAP(){
		util.startServers('PAP');
	}

	//Evento: nuevaCompra
	iniciarNuevaCompra(data){
		var sck = this.getClientByName('web');
		console.log('Emitiendo a: ' + sck.id);
		this.socket2.sockets.to(sck.id).emit('iniciarNuevaCompra', data);
		//this.socket2.sockets.connected[sck.id].emit('iniciarNuevaCompra', data);
		//console.log(this.socket2.sockets.connected[sck.id]);
	}

	recuperarCompras(data){
		var sck = this.getClientByName(data.server_name);
		this.socket2.to(sck.id).emit('getCompras', data);
	}

	recuperarEstado(data){
		var sck = this.getClientByName(data.server_name);
		this.socket2.to(sck.id).emit('getEstadoCompra', data);
	}

	avanzarCompra(data){
		var sck = this.getClientByName(data.server_name);
		this.socket2.to(sck.id).emit('avanzarCompra', data);
	}

	solicitarBajaServidor(data){
		var sck = this.getClientByName(data.server_name);
		console.log('Solicitando baja de ' + sck.server_name);
		this.socket2.to(sck.id).emit('finalizarEjecucion');
	}
	// *********************************************/

	//*********Eventos de los servidores*********/
	informarListadoCompras(data, sck){
		var aux = this.getClientById(sck.id);
		data.origen = aux.server_name;
		this.socket1.emit('listadoCompras', data);
	}

	informarEstadocompra(data, sck){
		var aux = this.getClientById(sck.id);
		data.origen = aux.server_name;
		this.socket1.emit('estadoCompra', data); 
	}
	//*****************************************/

	//***********Metodos de utilidad********************* */
	getClientById(id){
		return _.find(this.clientes, (item) => {
			return item.id == id;
		}); 	
	}
	
	getClientByName(name){
		return _.find(this.clientes, (item) =>{
			return item.server_name == name;
		});
	}

	deleteClientById(id){
		var indice;
		_.each(this.clientes, (item, index) => {
			var indice;
			if ( item.id == id ){
				console.log('Se desconecto servidor: ' + item.server_name);
				indice = index;
			}
		});
		this.clientes.splice(indice, 1);
	}
	//******************************************/
}

var monitor = new Monitor();

console.log('Monitor escuchando en el puerto 17850 y 17852');
