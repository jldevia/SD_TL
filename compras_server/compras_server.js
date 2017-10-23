var Compra = require('./compra');
var _ = require('underscore');
var amqp = require('amqplib');
const Stepper = require('../stepperEngine');
const EventEmitter = require('events').EventEmitter;
const util = require('../util');

'use strict';

class ServidorCompras extends EventEmitter{
	constructor(modo){
		super();

		this.modo = modo || 'AUTOMATICO';
		this.stepper = new Stepper(this.modo);

		//DB in memory: Infracciones en proceso o procesadas
		this.compras = new Array();

		this.on('nuevaCompra', (msg) => this.generarNuevaCompra(msg));

		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'compras'
			}
		});
		
		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));		
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getCompraByNum(data.num_compra);
		var resp = {
			num_compra : obj? obj.num_compra: '---------',
			estado : obj? obj.estado.nombre : '---------',
			prox_eventos : obj? obj.eventosPendientes : '---------'	
		};

		this.socket.emit('estadoCompra', resp);
	}
	
	informarComprasEnProceso(data){
		var listado = new Array();
		_.each(this.compras, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket.emit('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getCompraByNum(data.num_compra);
		this.stepper.emit('pasoManual', obj, data);
	}
	
	bajarServidor(data){
		process.exit(0);
	}
	//**************************************************

	generarNuevaCompra(msg){
		var newCompra = new Compra(this, msg.data);
		
		this.compras.push(newCompra);

		this.stepper.emit('paso', newCompra, msg.evento, msg.data);
		
		this.prox_num_compra++;

		
		console.log('----------------------------------');
		console.log('Nueva compra:\n' + JSON.stringify(newCompra.data));
		console.log('----------------------------------');
		var msg1 = 'Nueva compra:\\n' + JSON.stringify(newCompra.data);
		this.logMonitor(msg1);
	}

	eliminarCompra(num_compra){
		_.each(this.compras, (element, index) => {
			if ( element.num_compra == num_compra ){
				this.compras.splice(index, 1);
			}
		});
	}

	getCompraByNum(num_compra){
		return _.find(this.compras, (element) =>{
			return (element.num_compra == num_compra);
		});
	}

	logMonitor(msg){
		
		var data = {
			origen : 'compras',
			mensaje: util.formatearMsg(msg)
		};
		this.socket.emit('logMensaje', data);
	}

	publicarMensaje(topico, mensaje){
		var obj = this;
		amqp.connect('amqp://localhost')
			.then(function(con){
				con.createChannel()
					.then(function(chnl){
						var ex = 'compras.topic';
						chnl.assertExchange(ex, 'topic', {durable: true});
						chnl.publish(ex, topico, new Buffer(mensaje));
						console.log('------------------------------------------');
						console.log('Mensaje publicado:');
						console.log('Topico: %s\nMensaje: %s', topico, mensaje);
						console.log('------------------------------------------');
						var msg = 'Mensaje publicado:\\n';
						msg = msg + 'Topico: ' + topico + '\\n';
						msg = msg + 'Mensaje: ' + mensaje;
						obj.logMonitor(msg);
					})
					.catch(function(err){
						console.error('[Compras_server]: Error Creando canal: ' + err);
						obj.logMonitor('[Compras_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Compras_server]: Error conectando a servidor de mensajeria: ' + err);
				obj.logMonitor('[Compras_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}

}//fin de la clase

var server = new ServidorCompras(process.argv[2]);

console.log('[Compras_server] en ejecución en modo ' + server.modo);
server.logMonitor('[Compras_server] en ejecución en modo ' + server.modo);
console.log('Esperando mensajes...');
server.logMonitor('Esperando mensajes...');

amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'compras_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
					server.logMonitor('Mensaje recibido:\\n' + JSON.stringify(mensaje));
					
					if (mensaje.evento === 'nuevaCompra') {
						server.emit('nuevaCompra', mensaje);
					}else{
						var compra = server.getCompraByNum(mensaje.data.num_compra);
						server.stepper.emit('paso', compra, mensaje.evento, mensaje.data);
					}
					chn.ack(msg);	
				}, {noAck: false})
					.catch( function(err){
						console.error('[Compras_server]: Error al consumir mensajes: ' + err);
						server.logMonitor('[Compras_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Compras_server]: Error createChannel: '+ err);
				server.logMonitor('[Compras_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Compras_server]: Error connect: ' + err);
		server.logMonitor('[Compras_server]: Error connect: ' + err);
	});
